import { CloudFrontRequestEvent, CloudFrontRequestResult } from "aws-lambda";
import { S3 } from "aws-sdk";
import { URLSearchParams } from "url"

var mask = require("json-mask");

const s3 = new S3();

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
        const s3Obj = await s3.getObject(bucketParams).promise();
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
      } catch (err) {
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
    } catch (e) {
      console.error(`Unexpected error occurred: ${e.message}`);
      return {
        status: "500",
        statusDescription: "Internal Server Error"
      };
    }
  }

