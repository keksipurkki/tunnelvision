#!/usr/bin/env node
"use strict";

const ec2 = require("@aws-cdk/aws-ec2");
const ecs = require("@aws-cdk/aws-ecs");
const cdk = require("@aws-cdk/core");
const ecs_patterns = require("@aws-cdk/aws-ecs-patterns");

const tag = resource => `tunnelvision-${resource}`;

class TunnelvisionStack extends cdk.Stack {
  constructor(app, id) {
    super(app, id);

    const vpc = new ec2.Vpc(this, tag("Vpc"), {
      maxAzs: 3
    });

    const cluster = new ecs.Cluster(this, tag("MyCluster"), {
      vpc: vpc
    });

    // Create a load-balanced Fargate service and make it public
    new ecs_patterns.LoadBalancedFargateService(this, tag("FargateService"), {
      cluster,
      cpu: 512, 
      desiredCount: 6, 
      image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"), // Required
      memoryLimitMiB: 2048,
      publicLoadBalancer: true
    });

  }
}

const app = new cdk.App();
new TunnelvisionStack(app, TunnelvisionStack.name);
app.synth();
