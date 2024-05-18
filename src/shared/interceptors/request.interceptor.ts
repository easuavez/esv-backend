import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { createDecipheriv, randomBytes, scrypt } from "crypto";
import { Observable } from "rxjs";

const IgnoredPropertyName = Symbol('IgnoredPropertyName')
export function SkipInterceptor() {
    return (target, propertyKey, descriptor: PropertyDescriptor) => {
      descriptor.value[IgnoredPropertyName] = true
    }
}

@Injectable()
export class RequestInterceptor<T> implements NestInterceptor<T>{
    //this intercept can work for ALL GET,POST,DELETE,PUT,PATCH METHODS
    intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
        const http = context.switchToHttp()
        const request = http.getRequest()
        const isIgnoreInterceptor = context.getHandler()[IgnoredPropertyName]
        if (isIgnoreInterceptor) {
            return next.handle() //skip decryption if use decorator property at controller for specific api endpoint
        }
        if (request.method !== 'GET') {
          request.body = this.decryptPayloadBody(request.body?.payload, request.method) //assuming im receiving request JSON e.g {payload: "encryptedText"}
        }
        return next.handle()
    }
    decryptPayloadBody(payload, method) {
    console.log("🚀 ~ RequestInterceptor<T> ~ decryptPayloadBody ~ method:", method);
    console.log("🚀 ~ RequestInterceptor<T> ~ decryptPayloadBody ~ payload:", payload);

        // Decryption parameters
        const algorithm = process.env.ALGORITHM; // AES Decryption with 256-bit key in CBC mode. This must be same on frontend
        const key = Buffer.from(process.env.DECRYPT_SECRET_KEY, 'hex'); // 256-bit key. This must be same on frontend
        const iv = Buffer.from(process.env.DECRYPT_IV, 'hex'); // 16-byte IV for AES. This must be same on frontend
        console.log('aqui')
        // Decryption
        const decipher = createDecipheriv(algorithm, key, iv);
        console.log('here')
        let decryptedPayload = decipher.update(payload, 'hex', 'utf8');
        decryptedPayload += decipher.final('utf8');
        //if method is POST PUT DELETE then return body else do rest things for GET Req
        if (method !== 'GET') {
            return JSON.parse(decryptedPayload)
        }
        console.log('aca')
        // Parse the query string into an object
        const queryParams = new URLSearchParams(decryptedPayload);
        const queryParamsObject = {};
        for (const [key, value] of queryParams.entries()) {
            queryParamsObject[key] = value;
        }
        console.log('acuya')
        return queryParamsObject
    }

}