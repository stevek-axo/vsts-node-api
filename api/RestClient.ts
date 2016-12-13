// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import fs = require("fs");
import http = require("http");
import httpm = require('./HttpClient');
import ifm = require("./interfaces/common/VsoBaseInterfaces");
import serm = require('./Serialization');

export interface IRestClientResponse {
    statusCode: number,
    result: any
}

export class RestClient {
    client: RestCallbackClient;

    constructor(userAgent: string, handlers?: ifm.IRequestHandler[], socketTimeout?: number, versionParam?: string) {
        versionParam = versionParam || 'api-version';
        let httpc: httpm.HttpCallbackClient = new httpm.HttpCallbackClient(userAgent, handlers, socketTimeout);
        this.client = new RestCallbackClient(httpc, versionParam);
    }

    public get(requestUrl: string, 
               apiVersion: string, 
               additionalHeaders?: ifm.IHeaders, 
               serializationData?: serm.SerializationData): Promise<IRestClientResponse> {

        return this._getJson('GET', requestUrl, apiVersion, additionalHeaders || {});
    }

    public del(requestUrl: string, 
               apiVersion: string, 
               additionalHeaders?: ifm.IHeaders, 
               serializationData?: serm.SerializationData): Promise<IRestClientResponse> {

        return this._getJson('DELETE', requestUrl, apiVersion, additionalHeaders || {});
    }

    public create(requestUrl: string, 
                apiVersion: string, 
                objs: any, 
                additionalHeaders?: ifm.IHeaders, 
                serializationData?: serm.SerializationData): Promise<IRestClientResponse> {

        return this._sendRequest('POST', requestUrl, apiVersion, objs, additionalHeaders || {});
    }

    public update(requestUrl: string, 
                 apiVersion: string, 
                 objs: any, 
                 additionalHeaders?: ifm.IHeaders, 
                 serializationData?: serm.SerializationData): Promise<IRestClientResponse> {

        return this._sendRequest('PATCH', requestUrl, apiVersion, objs, additionalHeaders || {});
    }

    public replace(requestUrl: string, 
                 apiVersion: string, 
                 objs: any, 
                 additionalHeaders?: ifm.IHeaders, 
                 serializationData?: serm.SerializationData): Promise<IRestClientResponse> {

        return this._sendRequest('PUT', requestUrl, apiVersion, objs, additionalHeaders || {});
    }

    public uploadStream(verb: string, url: string, apiVersion: string, contentStream: NodeJS.ReadableStream, additionalHeaders: ifm.IHeaders, serializationData?: serm.SerializationData): Promise<IRestClientResponse> {
        return new Promise<IRestClientResponse>((resolve, reject) => {
            this.client.uploadStream(verb, url, apiVersion, contentStream, additionalHeaders || {}, (err:any, statusCode: number, obj: any) => {
                if (err) {
                    reject(err);
                }
                else {
                    let res: IRestClientResponse = <IRestClientResponse>{};
                    res.statusCode = statusCode;
                    res.result = obj;
                    resolve(res);
                }
            }, serializationData);
        });
    }

    private _getJson(verb: string, 
                     requestUrl: string, 
                     apiVersion: string, 
                     headers: ifm.IHeaders): Promise<IRestClientResponse> {

        return new Promise<IRestClientResponse>((resolve, reject) => {
            this.client._getJson(verb, requestUrl, apiVersion, headers, (err:any, statusCode: number, obj: any) => {
                if (err) {
                    reject(err);
                }
                else {
                    let res: IRestClientResponse = <IRestClientResponse>{};
                    res.statusCode = statusCode;
                    res.result = obj;
                    resolve(res);
                }
            });
        });
    }

    private _sendRequest(verb: string, 
                         requestUrl: string, 
                         apiVersion: string, 
                         objs: any, 
                         headers: ifm.IHeaders): Promise<IRestClientResponse> {

        return new Promise<IRestClientResponse>((resolve, reject) => {
            this.client._sendJson(verb, requestUrl, apiVersion, objs, headers, (err:any, statusCode: number, obj: any) => {
                if (err) {
                    reject(err);
                }
                else {
                    let res: IRestClientResponse = <IRestClientResponse>{};
                    res.statusCode = statusCode;
                    res.result = obj;
                    resolve(res);
                }
            });
        });
    }    
}

export class RestCallbackClient {
    baseUrl: string;
    basePath: string;
    httpClient: httpm.HttpCallbackClient;
    versionParam: string;

    constructor(httpClient: httpm.HttpCallbackClient, versionParam?: string) {
        versionParam = versionParam || 'api-version';
        this.httpClient = httpClient;
        this.versionParam = versionParam;
    }

    get(url: string, apiVersion: string, customHeaders: ifm.IHeaders, onResult: (err: any, statusCode: number, obj: any) => void): void {
        this._getJson('GET', url, apiVersion, customHeaders, onResult);
    }

    del(url: string, apiVersion: string, customHeaders: ifm.IHeaders, onResult: (err: any, statusCode: number, obj: any) => void): void {
        this._getJson('DELETE', url, apiVersion, customHeaders, onResult);
    }

    create(url: string, apiVersion: string, resources: any, customHeaders: ifm.IHeaders, onResult: (err: any, statusCode: number, obj: any) => void, serializationData?: serm.SerializationData): void {
        var headers = customHeaders || {};
        headers["Accept"] = this.createAcceptHeader('application/json', apiVersion);
        headers["Content-Type"] = headers["Content-Type"] || 'application/json; charset=utf-8';        
        this._sendJson('POST', url, apiVersion, resources, customHeaders, onResult);
    }

    update(url: string, apiVersion: string, resources: any, customHeaders: ifm.IHeaders, onResult: (err: any, statusCode: number, obj: any) => void, serializationData?: serm.SerializationData): void {
        this._sendJson('PATCH', url, apiVersion, resources, customHeaders, onResult);
    }

    options(url: string, onResult: (err: any, statusCode: number, obj: any) => void): void {
        this._getJson('OPTIONS', url, "", null, onResult);
    }

    uploadFile(verb: string, url: string, apiVersion: string, filePath: string, customHeaders: ifm.IHeaders, onResult: (err: any, statusCode: number, obj: any) => void, serializationData?: serm.SerializationData): void {
        fs.stat(filePath, (err, stats) => {
            if (err) {
                onResult(err, 400, null);
                return;
            }

            var headers = customHeaders || {};
            headers["Content-Length"] = stats.size;

            var contentStream: NodeJS.ReadableStream = fs.createReadStream(filePath);

            this.uploadStream(verb, url, apiVersion, contentStream, headers, onResult, serializationData);
        });
    }

    uploadStream(verb: string, url: string, apiVersion: string, contentStream: NodeJS.ReadableStream, customHeaders: ifm.IHeaders, onResult: (err: any, statusCode: number, obj: any) => void, serializationData?: serm.SerializationData): void {
        var headers = customHeaders || {};
        headers["Accept"] = this.createAcceptHeader('application/json', apiVersion);

        this.httpClient.sendStream(verb, url, contentStream, headers, (err: any, res: ifm.IHttpResponse, contents: string) => {
            if (err) {
                onResult(err, err.statusCode, contents);
                return;
            }

            _processResponse(url, res, contents, onResult);
        });
    }

    replace(url: string, apiVersion: string, resources: any, customHeaders: ifm.IHeaders, onResult: (err: any, statusCode: number, obj: any) => void): void {
        this._sendJson('PUT', url, apiVersion, resources, customHeaders, onResult);
    }

    _getJson(verb: string, url: string, apiVersion: string, customHeaders: ifm.IHeaders, onResult: (err: any, statusCode: number, obj: any) => void): void {

        var headers = {};
        headers["Accept"] = this.createAcceptHeader('application/json', apiVersion);
        this.httpClient.get(verb, url, headers, (err: any, res: ifm.IHttpResponse, contents: string) => {
            if (err) {
                onResult(err, err.statusCode, null);
                return;
            }

            _processResponse(url, res, contents, onResult);
        });
    }

    _sendJson(verb: string, url: string, apiVersion: string, resources: any, customHeaders: ifm.IHeaders, onResult: (err: any, statusCode: number, obj: any) => void): void {
        if (!resources) {
            throw new Error('invalid resource');
        }

        var headers = customHeaders || {};
        headers["Accept"] = this.createAcceptHeader('application/json', apiVersion);
        headers["Content-Type"] = headers["Content-Type"] || 'application/json; charset=utf-8';
        
        let data: string;

        data = JSON.stringify(resources, null, 2);

        this.httpClient.send(verb, url, data, headers, (err: any, res: ifm.IHttpResponse, contents: string) => {
            if (err) {
                onResult(err, err.statusCode, null);
                return;
            }

            _processResponse(url, res, contents, onResult);
        });
    }

    public createAcceptHeader(type: string, apiVersion?: string): string {
        return type + (apiVersion ? (';' + this.versionParam + '=' + apiVersion) : '');
    }    

}

var httpCodes = {
    300: "Multiple Choices",
    301: "Moved Permanantly",
    302: "Resource Moved",
    304: "Not Modified",
    305: "Use Proxy",
    306: "Switch Proxy",
    307: "Temporary Redirect",
    308: "Permanent Redirect",
    400: "Bad Request",
    401: "Unauthorized",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    406: "Not Acceptable",
    407: "Proxy Authentication Required",
    408: "Request Timeout",
    409: "Conflict",
    410: "Gone",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout"
}

function _processResponse(url: string, 
                                res: ifm.IHttpResponse, 
                                contents: string, 
                                onResult: (err: any, statusCode: number, obj: any) => void) {
    let jsonObj: any;

    if (contents && contents.length > 0) {
        try {
            jsonObj = JSON.parse(contents);
        } catch (e) {
            onResult(new Error('Invalid Resource'), res.statusCode, null);
            return;            
        }
    }

    if (res.statusCode > 299) {
        // default error message
        var msg = httpCodes[res.statusCode] ? "Failed Request: " + httpCodes[res.statusCode] : "Failed Request";
        msg += '(' + res.statusCode + ') - ';

        // if exception/error in body, attempt to get better error
        if (jsonObj && jsonObj.message) {
            msg += jsonObj.message;
        } else {
            msg += url;
        }

        onResult(new Error(msg), res.statusCode, null);
    } else {
        onResult(null, res.statusCode, jsonObj);
    }
};
