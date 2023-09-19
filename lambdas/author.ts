import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { CloudFrontRequestEvent, CloudFrontRequestResult } from "aws-lambda";
import { URLSearchParams } from "url";

var mask = require("json-mask");

const s3Client = new S3Client({});

export const handler =
  async (event: CloudFrontRequestEvent): Promise<CloudFrontRequestResult> => {
    try {
      console.log(`Request: ${JSON.stringify(event)}`);
      const request = event.Records[0].cf.request;

      const authorId = request.uri.split('/').pop();

      const params = new URLSearchParams(request.querystring);
      const fields = params.get("fields");
      const key = `author/${authorId}.json`;

      const bucketParams = {
        Bucket: request.origin?.s3?.domainName.split('.')[0] ?? '',
        Key: key,
      };

      console.log(`Retrieving : ${bucketParams.Key} from ${bucketParams.Bucket}`);

      try {
        const s3Obj = await s3Client.send(new GetObjectCommand(bucketParams));
        const j = JSON.parse((s3Obj?.Body ?? {}).toString());
        const maskedObj = mask(j, fields);

        return {
          status: "200",
          statusDescription: "OK",
          bodyEncoding: "text",
          body: JSON.stringify(maskedObj),
          headers: {
            "content-type": [{
              key: "Content-Type",
              value: "application/json"
            }]
          }
        };
      } catch (err: any) {
        //fix code

        if (err.code == "NoSuchKey") {
          console.error(`${err.code}: ${bucketParams.Bucket}/${bucketParams.Key}`);
          return {
            status: "404",
            statusDescription: "Not Found"
          };
        } else {
          console.error(`Unexpected AWS error occurred: ${err.message}`);
          return {
            status: "500",
            statusDescription: "Internal Server Error"
          };
        }
      }
    } catch (e: any) {
      console.error(`Unexpected error occurred: ${e.message}`);
      return {
        status: "500",
        statusDescription: "Internal Server Error"
      };
    }
  }

