import { Stack, StackProps, CfnOutput } from 'monocdk';
import { Construct } from 'constructs';
import { Bucket } from 'monocdk/aws-s3';
import { Code, Function as LambdaFunction, Runtime } from 'monocdk/aws-lambda';
import { PolicyStatement, Policy } from 'monocdk/aws-iam';
import { S3Origin } from 'monocdk/aws-cloudfront-origins';
import { 
  Function as CFFunction,
  FunctionCode,
  Distribution,
  FunctionEventType,
  LambdaEdgeEventType, 
  ViewerProtocolPolicy,
  CachePolicy
} from 'monocdk/aws-cloudfront';

export class EdgeStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);  

    const originBucket = new Bucket(this, "cf-origin");
    const s3Origin = new S3Origin(originBucket);
    

    const redirectFunction = new CFFunction(this, 'redirectFunction', {
      code: FunctionCode.fromFile({
        filePath: 'funcs/redirect.js'
      }),
    });

    const rejectFunction = new CFFunction(this, 'rejectFunction', {
      code: FunctionCode.fromFile({
        filePath: 'funcs/reject.js'
      }),
    });

    const cacheControlFunction = new CFFunction(this, 'cacheControlFunction', {
      code: FunctionCode.fromFile({
        filePath: 'funcs/cacheControl.js'
      }),
    });

    // must be in us-east-1; set in bin.ts
    // cannot specify env vars in l@e
    const authorFunction = new LambdaFunction(this, 'authorLambda', {
      code: Code.fromAsset("lambdas"),
      handler: "author.handler",
      runtime: Runtime.NODEJS_16_X,
    });

    const s3PolicyStatement = new PolicyStatement({
      actions: ['s3:*'],
      resources: [originBucket.bucketArn],
    });

    authorFunction.role?.attachInlinePolicy(
      new Policy(this, 'bucket-policy', {
        statements: [s3PolicyStatement],
      }),
    );
    
    //default to disabled cache to allow faster development feedback
    const defaultCachePolicy = CachePolicy.CACHING_DISABLED;
    const defaultViewerProtocolPolicy = ViewerProtocolPolicy.REDIRECT_TO_HTTPS;
    
    const distro = new Distribution(this, 'cf-distro', {
      defaultBehavior: {
        viewerProtocolPolicy: defaultViewerProtocolPolicy,
        origin: s3Origin,
        functionAssociations: [{
          function: rejectFunction,
          eventType: FunctionEventType.VIEWER_REQUEST,
        }],
        cachePolicy: defaultCachePolicy

      },
      additionalBehaviors: {
        'entry/*.json': {
          viewerProtocolPolicy: defaultViewerProtocolPolicy,
          origin: s3Origin,
          functionAssociations: [{
            function: cacheControlFunction,
            eventType: FunctionEventType.VIEWER_RESPONSE,
          }],
    
          cachePolicy: defaultCachePolicy
        },
        'blog/*': {
          viewerProtocolPolicy: defaultViewerProtocolPolicy,
          origin: s3Origin,
          functionAssociations: [
            {
              function: redirectFunction,
              eventType: FunctionEventType.VIEWER_REQUEST,
            },
            {
              function: cacheControlFunction,
              eventType: FunctionEventType.VIEWER_RESPONSE,
            }
          ],
    
          cachePolicy: defaultCachePolicy
        },
        'author/*.json?fields*': {
          viewerProtocolPolicy: defaultViewerProtocolPolicy,
          origin: s3Origin,
          edgeLambdas: [{
            functionVersion: authorFunction.currentVersion,
            eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
          }],
          functionAssociations: [{
              function: cacheControlFunction,
              eventType: FunctionEventType.VIEWER_RESPONSE,
          }],
    
          cachePolicy: defaultCachePolicy
        },
        'author/*.json': {
          viewerProtocolPolicy: defaultViewerProtocolPolicy,
          origin: s3Origin,
          functionAssociations: [{
              function: cacheControlFunction,
              eventType: FunctionEventType.VIEWER_RESPONSE,
          }],
          cachePolicy: defaultCachePolicy
        }
      }
    });

    new CfnOutput(this, 'originBucketName', {
      value: originBucket.bucketName,
      description: 'The name of the CloudFront origin s3 bucket',
      exportName: 'originBucketName',
    });

    new CfnOutput(this, 'distributionDomainName', {
      value: distro.domainName,
      description: 'The domain of the CloudFront distribution',
      exportName: 'distributionDomainName',
    });
  };
}
