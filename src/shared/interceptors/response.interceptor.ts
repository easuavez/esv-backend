import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { createDecipheriv, createCipheriv, randomBytes, scrypt } from "crypto";

export interface Response<T> {
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map (
        data => (
          this.encryptPayloadResponse(data)
        )
      )
    );
  }
  encryptPayloadResponse(payload) {
    const algorithm = process.env.ALGORITHM;
    const key = Buffer.from(process.env.DECRYPT_SECRET_KEY, 'hex');
    const iv = Buffer.from(process.env.DECRYPT_IV, 'hex');

    const cipher = createCipheriv(algorithm, key, iv);

    const toEncrypt = JSON.stringify(payload);

    let encryptedPayload = Buffer.concat([
      cipher.update(toEncrypt),
      cipher.final(),
    ]);

    return encryptedPayload;
  }
}