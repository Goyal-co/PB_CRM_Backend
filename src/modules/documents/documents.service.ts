import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import { CurrentUser } from '@common/types/user.types';
import { DocType } from '@common/types/supabase.types';
import { getBookingForUser } from '@common/utils/access.util';
import { throwFromPostgrest } from '@common/utils/supabase-errors';
import { VerifyDocumentDto } from './dto/verify-document.dto';
import {
  BUCKET_ALLOWED_MIMES,
  BUCKET_MAX_BYTES,
  STORAGE_BUCKETS,
  StorageBucketId,
  isPublicBucket,
} from './storage-buckets.constants';

const KYC_TYPES: DocType[] = [
  'aadhar_card',
  'pan_card',
  'passport',
  'voter_id',
  'driving_license',
  'oci_pio_card',
  'business_card',
  'passport_photo',
];

@Injectable()
export class DocumentsService {
  constructor(private readonly supabase: SupabaseService) {}

  private admin() {
    return this.supabase.supabaseAdmin;
  }

  /**
   * Maps document type to the Supabase bucket name (dashboard buckets).
   */
  private bucketForType(type: DocType): StorageBucketId {
    if (type === 'floor_plan') {
      return STORAGE_BUCKETS.FLOOR_PLANS;
    }
    if (type === 'agreement_for_sale') {
      return STORAGE_BUCKETS.AGREEMENTS;
    }
    if (type === 'payment_receipt') {
      return STORAGE_BUCKETS.PAYMENT_RECEIPTS;
    }
    if (KYC_TYPES.includes(type) || type === 'other') {
      return STORAGE_BUCKETS.KYC;
    }
    return STORAGE_BUCKETS.KYC;
  }

  private assertMimeForBucket(bucket: StorageBucketId, mime: string): void {
    const allowed = BUCKET_ALLOWED_MIMES[bucket];
    if (!allowed.includes(mime)) {
      throw new UnsupportedMediaTypeException({
        message: `File type not allowed for bucket ${bucket}`,
        error: 'UNSUPPORTED_MEDIA_TYPE',
      });
    }
  }

  /**
   * Public bucket (`floor-plans`) uses a stable public URL; private buckets use signed URLs.
   */
  private async resolveFileAccess(
    bucket: string,
    storagePath: string,
  ): Promise<{ url: string; expires_at: string | null }> {
    if (isPublicBucket(bucket)) {
      const { data } = this.admin().storage
        .from(bucket)
        .getPublicUrl(storagePath);
      return { url: data.publicUrl, expires_at: null };
    }
    const signed = await this.admin().storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600);
    return {
      url: signed.data?.signedUrl ?? '',
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
  }

  private assertUploadAllowed(
    user: CurrentUser,
    type: DocType,
    bookingUserId: string,
  ): void {
    const nonKycManager =
      type === 'agreement_for_sale' ||
      type === 'payment_receipt' ||
      type === 'floor_plan';
    if (user.role === 'user') {
      if (nonKycManager) {
        throw new ForbiddenException({
          message: 'Users may only upload KYC documents',
          error: 'FORBIDDEN',
        });
      }
      if (bookingUserId !== user.id) {
        throw new ForbiddenException({
          message: 'Cannot upload to this booking',
          error: 'FORBIDDEN',
        });
      }
    }
  }

  /**
   * Multipart upload entry-point: streams bytes into the right Storage bucket and inserts metadata.
   */
  async handleUpload(params: {
    user: CurrentUser;
    bookingId: string;
    type: DocType;
    buffer: Buffer;
    filename: string;
    mime: string;
    allotteeIndex: number;
    notes?: string;
  }): Promise<unknown> {
    const booking = (await getBookingForUser(
      this.supabase,
      params.user,
      params.bookingId,
    )) as { user_id: string; project_id: string };
    this.assertUploadAllowed(
      params.user,
      params.type,
      booking.user_id as string,
    );

    const bucket = this.bucketForType(params.type);
    const maxBytes = BUCKET_MAX_BYTES[bucket];
    if (params.buffer.length > maxBytes) {
      throw new PayloadTooLargeException({
        message: `File too large for bucket ${bucket} (max ${maxBytes} bytes)`,
        error: 'PAYLOAD_TOO_LARGE',
      });
    }
    this.assertMimeForBucket(bucket, params.mime);
    const ext = params.filename.includes('.')
      ? params.filename.substring(params.filename.lastIndexOf('.'))
      : '';
    const objectId = `${randomUUID()}${ext}`;

    let storagePath: string;
    if (bucket === STORAGE_BUCKETS.KYC) {
      storagePath = `${params.bookingId}/${params.allotteeIndex}/${params.type}/${objectId}`;
    } else if (bucket === STORAGE_BUCKETS.AGREEMENTS) {
      storagePath = `${params.bookingId}/v1/${objectId}`;
    } else if (bucket === STORAGE_BUCKETS.PAYMENT_RECEIPTS) {
      storagePath = `${params.bookingId}/receipts/${objectId}`;
    } else {
      storagePath = `${params.bookingId}/${objectId}`;
    }

    if (params.type === 'agreement_for_sale') {
      const { error: upPrev } = await this.admin()
        .from('documents')
        .update({ is_latest_version: false })
        .eq('booking_id', params.bookingId)
        .eq('type', 'agreement_for_sale');
      if (upPrev) {
        throwFromPostgrest(upPrev, 'DOCUMENT_VERSION_UPDATE_FAILED');
      }
    }

    const { error: upErr } = await this.admin().storage
      .from(bucket)
      .upload(storagePath, params.buffer, { contentType: params.mime });
    if (upErr) {
      throw new ConflictException({
        message: upErr.message,
        error: 'STORAGE_UPLOAD_FAILED',
      });
    }

    const { data: doc, error: docErr } = await this.admin()
      .from('documents')
      .insert({
        booking_id: params.bookingId,
        project_id: booking.project_id,
        type: params.type,
        storage_path: storagePath,
        file_name: params.filename,
        size_bytes: params.buffer.length,
        mime_type: params.mime,
        notes: params.notes ?? null,
        is_latest_version: true,
        uploaded_by_id: params.user.id,
        allottee_index: params.allotteeIndex,
      })
      .select()
      .single();
    if (docErr) {
      throwFromPostgrest(docErr, 'DOCUMENT_INSERT_FAILED');
    }

    const access = await this.resolveFileAccess(bucket, storagePath);
    return {
      ...(doc as object),
      access_url: access.url,
      expires_at: access.expires_at,
      ...(isPublicBucket(bucket)
        ? { public_url: access.url }
        : { signed_url: access.url }),
    };
  }

  async list(
    user: CurrentUser,
    query: {
      booking_id?: string;
      type?: DocType;
      is_verified?: boolean;
      page: number;
      limit: number;
    },
  ): Promise<{ data: unknown[]; meta: Record<string, number> }> {
    if (user.role === 'manager' && !query.booking_id) {
      throw new BadRequestException({
        message: 'booking_id is required for managers',
        error: 'BOOKING_ID_REQUIRED',
      });
    }

    const from = (query.page - 1) * query.limit;
    const to = from + query.limit - 1;
    let qb = this.admin().from('documents').select('*', { count: 'exact' });

    if (query.booking_id) {
      await getBookingForUser(this.supabase, user, query.booking_id);
      qb = qb.eq('booking_id', query.booking_id);
    } else if (user.role === 'user') {
      const { data: mine, error: mErr } = await this.admin()
        .from('bookings')
        .select('id')
        .eq('user_id', user.id);
      if (mErr) {
        throwFromPostgrest(mErr, 'BOOKING_IDS_FAILED');
      }
      const ids = (mine as { id: string }[] | null)?.map((r) => r.id) ?? [];
      if (!ids.length) {
        return {
          data: [],
          meta: {
            total: 0,
            page: query.page,
            limit: query.limit,
            totalPages: 1,
          },
        };
      }
      qb = qb.in('booking_id', ids);
    }
    if (query.type) {
      qb = qb.eq('type', query.type);
    }
    if (query.is_verified !== undefined) {
      qb = qb.eq('is_verified', query.is_verified);
    }

    const { data, error, count } = await qb
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) {
      throwFromPostgrest(error, 'DOCUMENTS_LIST_FAILED');
    }
    const total = count ?? 0;
    return {
      data: data ?? [],
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async findOne(user: CurrentUser, id: string): Promise<unknown> {
    const { data, error } = await this.admin()
      .from('documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throwFromPostgrest(error, 'DOCUMENT_LOAD_FAILED');
    }
    if (!data) {
      throw new NotFoundException({
        message: 'Document not found',
        error: 'DOCUMENT_NOT_FOUND',
      });
    }
    const d = data as {
      booking_id: string;
      type: DocType;
      storage_path: string;
    };
    await getBookingForUser(this.supabase, user, d.booking_id);
    const bucket = this.bucketForType(d.type);
    const access = await this.resolveFileAccess(bucket, d.storage_path);
    return {
      ...d,
      storage_bucket: bucket,
      access_url: access.url,
      expires_at: access.expires_at,
      ...(isPublicBucket(bucket)
        ? { public_url: access.url }
        : { signed_url: access.url }),
    };
  }

  async signedUrl(user: CurrentUser, id: string): Promise<unknown> {
    const row = (await this.findOne(user, id)) as {
      access_url?: string;
      expires_at?: string | null;
      storage_bucket?: string;
    };
    const b = row.storage_bucket;
    return {
      url: row.access_url,
      expires_at: row.expires_at ?? undefined,
      is_public: b ? isPublicBucket(b) : false,
    };
  }

  async remove(user: CurrentUser, id: string): Promise<{ success: boolean }> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Forbidden',
        error: 'FORBIDDEN',
      });
    }
    const { data, error } = await this.admin()
      .from('documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throwFromPostgrest(error, 'DOCUMENT_LOAD_FAILED');
    }
    if (!data) {
      throw new NotFoundException({
        message: 'Document not found',
        error: 'DOCUMENT_NOT_FOUND',
      });
    }
    if ((data as { type: string }).type === 'agreement_for_sale') {
      throw new ForbiddenException({
        message: 'Cannot delete executed agreement',
        error: 'AGREEMENT_LOCKED',
      });
    }
    const d = data as {
      type: DocType;
      storage_path: string;
    };
    const bucket = this.bucketForType(d.type);
    const { error: sErr } = await this.admin().storage
      .from(bucket)
      .remove([d.storage_path]);
    if (sErr) {
      throw new ConflictException({
        message: sErr.message,
        error: 'STORAGE_DELETE_FAILED',
      });
    }
    const { error: delErr } = await this.admin()
      .from('documents')
      .delete()
      .eq('id', id);
    if (delErr) {
      throwFromPostgrest(delErr, 'DOCUMENT_DELETE_FAILED');
    }
    return { success: true };
  }

  async verify(
    user: CurrentUser,
    id: string,
    dto: VerifyDocumentDto,
  ): Promise<unknown> {
    if (user.role === 'user') {
      throw new ForbiddenException({
        message: 'Forbidden',
        error: 'FORBIDDEN',
      });
    }
    const { data, error } = await this.admin()
      .from('documents')
      .update({
        is_verified: dto.is_verified,
        rejection_reason: dto.rejection_reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      throwFromPostgrest(error, 'DOCUMENT_VERIFY_FAILED');
    }
    return data;
  }
}
