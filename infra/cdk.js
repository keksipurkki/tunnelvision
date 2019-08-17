#!/usr/bin/env node
"use strict";

require("dotenv").config();

const fs = require("fs");
const ec2 = require("@aws-cdk/aws-ec2");
const autoscaling = require("@aws-cdk/aws-autoscaling");
const iam = require("@aws-cdk/aws-iam");
const cdk = require("@aws-cdk/core");

const provisionImage = fs
  .readFileSync(`${__dirname}/provision.sh`)
  .toString()
  .split("\n")
  .filter(Boolean);

const tag = resource => `tunnelvision-${resource}`;

/**
 *
 * Autoscaling group
 *
 */
class TunnelvisionStack extends cdk.Stack {
  constructor(app, id, env) {
    super(app, id, env);

    const vpc = ec2.Vpc.fromLookup(this, "VPC", {
      isDefault: true
    });

    const machineImage = new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      edition: ec2.AmazonLinuxEdition.STANDARD,
      virtualization: ec2.AmazonLinuxVirt.HVM,
      storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE
    });

    const instanceType = ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO);

    const asg = new autoscaling.AutoScalingGroup(this, tag("ASG"), {
      vpc,
      associatePublicIpAddress: true,
      desiredCapacity: 1,
      minCapacity: 0,
      maxCapacity: 1,
      instanceType,
      machineImage,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC }
    });

    asg.addUserData(...provisionImage);

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

    const policy = iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonRoute53FullAccess");
    asg.role.addManagedPolicy(policy);

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
