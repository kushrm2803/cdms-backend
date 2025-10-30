import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { v4 as uuid } from 'uuid';

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);
  private readonly s3: S3;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {

    this.bucketName = this.configService.getOrThrow<string>('MINIO_BUCKET_NAME');
    const endpoint = this.configService.getOrThrow<string>('MINIO_ENDPOINT');
    const port = this.configService.getOrThrow<number>('MINIO_PORT');
    const accessKey = this.configService.getOrThrow<string>('MINIO_ACCESS_KEY');
    const secretKey = this.configService.getOrThrow<string>('MINIO_SECRET_KEY');

    this.s3 = new S3({
      endpoint: `http://${endpoint}:${port}`,
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      sslEnabled: false,
      s3ForcePathStyle: true,
    });

    this.logger.log('MinIO Service Initialized. Endpoint: ' + this.s3.config.endpoint);
  }

  /**
   * Uploads a file to the MinIO bucket
   * @param file The file buffer
   * @param fileExtension The original file extension (e.g., '.jpg')
   * @returns The S3 UploadResponse (contains URL, ETag, etc.)
   */
  async upload(file: Express.Multer.File, fileExtension: string) {
    // Generate a unique file name to prevent collisions
    const uniqueFileName = `${uuid()}${fileExtension}`;

    this.logger.log(`Uploading file '${uniqueFileName}' to bucket '${this.bucketName}'...`);

    return this.s3
      .upload({
        Bucket: this.bucketName,
        Key: uniqueFileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
      .promise();
  }
}