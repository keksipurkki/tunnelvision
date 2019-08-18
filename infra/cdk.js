#!/usr/bin/env node
"use strict";

require("dotenv").config();


const path = require("path");
const fs = require("fs");
const ec2 = require("@aws-cdk/aws-ec2");
const autoscaling = require("@aws-cdk/aws-autoscaling");
const ecs = require("@aws-cdk/aws-ecs");
const iam = require("@aws-cdk/aws-iam");
const cdk = require("@aws-cdk/core");
const logs = require("@aws-cdk/aws-logs");

const policies = [
  "AmazonRoute53FullAccess", // TLS Cert challange
  "AmazonS3FullAccess", // TLS Cert persistence
  "CloudWatchLogsFullAccess", // Logging
];

const tag = resource => `tunnelvision-${resource}`;

class TunnelvisionStack extends cdk.Stack {
  constructor(app, id, context) {
    super(app, id, context);

    const vpc = ec2.Vpc.fromLookup(this, "VPC", {
      isDefault: true
    });

    const machineImage = ecs.EcsOptimizedImage.amazonLinux2();
    const instanceType = ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO);

    const asg = new autoscaling.AutoScalingGroup(this, tag("ASG"), {
      vpc,
      associatePublicIpAddress: true,
      desiredCapacity: 1,
      minCapacity: 0,
      maxCapacity: 1,
      instanceType,
      machineImage,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      }
    });

    const userData = fs
      .readFileSync(path.join(__dirname, "provision.sh"))
      .toString()
      .split("\n")
      .filter(Boolean);

    asg.addUserData(...userData);

    const [securityGroup] = asg.securityGroups;

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "allow ssh access from the world"
    );

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "allow https from the world"
    );

    for (const policyName of policies) {
      const policy = iam.ManagedPolicy.fromAwsManagedPolicyName(policyName);
      asg.role.addManagedPolicy(policy);
    }

    // Log group for provisioning output
    new logs.LogGroup(this, tag("provisionLogs"), {
      logGroupName: "/tunnelvision/provision"
    });

  }
}

const app = new cdk.App();

new TunnelvisionStack(app, TunnelvisionStack.name, {
  env: {
    account: process.env.AWS_ACCOUNT,
    region: process.env.AWS_REGION
  }
});

app.synth();
