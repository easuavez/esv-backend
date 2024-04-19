import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { Readable } from 'stream';
import DocumentCreated from './events/DocumentCreated';
import { Document, DocumentOption } from './model/document.entity';
import { DocumentName } from './model/document.enum';
import * as documents from './model/documents.json';
import { publish } from 'ett-events-lib';
import DocumentUpdated from './events/DocumentUpdated';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentRepository = getRepository(Document),
  ) {
    AWS.config.update({
      apiVersion: "2006-03-01",
      region: process.env.AWS_DEFAULT_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
  }

  private reportType = {
    terms_of_service: 'terms_of_service'
  };

  public getBucketPath(reportType: string): string {
    const folder = this.reportType[reportType];
    return `${process.env.AWS_S3_COMMERCE_BUCKET}/${folder}`;
  }

  public getDocumentOptions(): DocumentOption[] {
    const options = documents;
    return options.sort((a, b) => a.type < b.type ? -1 : 1);
  }

  public async getDocumentById(id: string): Promise<Document> {
    return await this.documentRepository.findById(id);
  }

  public async createDocument(user: string, name: string, commerceId: string, option: string, format: string): Promise<Document> {
    let document = new Document();
    const existingDocument = await this.getDocumentsByOption(commerceId, option);
    if (existingDocument) {
      document = existingDocument;
      document.name = name;
      document.active = true;
      document.format = format;
      document.modifiedBy = user;
      document.modifiedAt = new Date();
      return await this.update(user, document);
    } else {
      document.name = name;
      document.commerceId = commerceId;
      document.type = commerceId ? DocumentName.COMMERCE : DocumentName.STANDARD;
      document.active = true;
      document.format = format;
      document.option = option;
      document.createdBy = user;
      document.createdAt = new Date();
      const documentCreated = await this.documentRepository.create(document);
      const documentCreatedEvent = new DocumentCreated(new Date(), documentCreated, { user });
      publish(documentCreatedEvent);
      return documentCreated;
    }
  }

  public async updateDocument(user: string, id: string, active: boolean): Promise<Document> {
    let document = await this.getDocumentById(id);
    if (active !== undefined) {
      document.active = active;
    }
    return await this.update(user, document);
  }

  public async getDocumentsByCommerceId(commerceId: string): Promise<Document[]> {
    const result = await this.documentRepository
    .whereEqualTo('commerceId', commerceId)
    .orderByAscending('type')
    .find();
    return result;
  }

  public async getDocumentsByOption(commerceId: string, option: string): Promise<Document> {
    const result = await this.documentRepository
    .whereEqualTo('commerceId', commerceId)
    .whereEqualTo('option', option)
    .findOne();
    return result;
  }

  public async update(user: string, document: Document): Promise<Document> {
    const documentUpdated = await this.documentRepository.update(document);
      const documentUpdatedEvent = new DocumentUpdated(new Date(), documentUpdated, { user });
      publish(documentUpdatedEvent);
    return documentUpdated;
  }

  public getDocument(documentKey: string, reportType: string): Readable {
    const S3 = new AWS.S3();
    let bucketAndPath = this.getBucketPath(reportType);
    let key = documentKey;
    const getObjectRequest: AWS.S3.GetObjectRequest = { Bucket: bucketAndPath, Key: key };
    try {
      return S3.getObject(getObjectRequest).createReadStream();
    } catch (error) {
      throw new HttpException('Objeto no encontrado', HttpStatus.NOT_FOUND);
    }
  }

  public async uploadDocument(user: string, commerceId: string, reportType: string, filename: string, format: string, files: any): Promise<any> {
    const S3 = new AWS.S3();
    const name = `${filename}.${format.split('/')[1]}`;
    if (!files || files.length == 0) {
      throw new HttpException('Archivo no enviado', HttpStatus.NOT_FOUND);
    }
    await new Promise((resolve, reject) => {
      S3.upload(
        {
          Bucket: this.getBucketPath(reportType),
          Body: files[0].buffer,
          Key: name,
          ACL: 'private',
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }
          return resolve(result);
        },
      );
    }).then(async () => {
      await this.createDocument(user, name, commerceId, reportType, format);
    });
  }

  public async getDocumentsList(reportType: string, documentKey: string): Promise<AWS.S3.ObjectList> {
    const S3 = new AWS.S3();
    return new Promise((resolve, reject) => {
      S3.listObjectsV2({ Bucket: this.getBucketPath(reportType), Prefix: documentKey }, (error, result) => {
          if (error) {
            return reject(error);
          }
          return resolve(result.Contents);
        });
      });
    }
  }

