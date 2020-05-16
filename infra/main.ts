import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as logs from "@aws-cdk/aws-logs";
import * as ecs from "@aws-cdk/aws-ecs";

class TunnelvisionStack extends cdk.Stack {
  constructor(scope: cdk.Construct) {
    super(scope, "tunnelvision", {
      description: "tunnelvision.me",
      env: {
        account: process.env.AWS_ACCOUNT,
        region: process.env.AWS_DEFAULT_REGION
      }
    });
  }

  service() {
    const service = new ecs.FargateService(this, "tunnelvision-service", {
      serviceName: "tunnelvision",
      cluster: this.cluster,
      taskDefinition: this.taskDefinition
    });

    service.connections.allowFromAnyIpv4(ec2.Port.tcp(22), "Allow SSH");
    service.connections.allowFromAnyIpv4(ec2.Port.tcp(443), "Allow HTTPS");

    return service;
  }

  get cluster() {
    return new ecs.Cluster(this, "tunnelvision-cluster", {
      vpc: ec2.Vpc.fromLookup(this, "default-vpc", {
        isDefault: true
      })
    });
  }

  get taskDefinition() {
    const taskDefinition = new ecs.FargateTaskDefinition(this, "tunnelvision-taskdefinition", {
      taskRole: this.taskRole
    });

    const logGroup = new logs.LogGroup(this, "tunnelvision-logs", {
      logGroupName: "tunnelvision.me"
    });

    const server = taskDefinition.addContainer("nginx", {
      image: ecs.ContainerImage.fromAsset("infra", {
        file: "Dockerfile.server"
      }),
      logging: ecs.LogDriver.awsLogs({
        logGroup,
        streamPrefix: "server",
        logRetention: logs.RetentionDays.ONE_MONTH
      })
    });

    const app = taskDefinition.addContainer("app", {
      image: ecs.ContainerImage.fromAsset("infra", {
        file: "Dockerfile.app"
      }),
      logging: ecs.LogDriver.awsLogs({
        logGroup,
        streamPrefix: "app",
        logRetention: logs.RetentionDays.ONE_MONTH
      }),
      environment: {
        MAX_CONNECTIONS: "50",
        FORCE_COLOR: "1",
        NODE_ENV: "production"
      }
    });

    const certbot = taskDefinition.addContainer("certbot", {
      image: ecs.ContainerImage.fromAsset("infra", {
        file: "Dockerfile.certbot"
      }),
      logging: ecs.LogDriver.awsLogs({
        logGroup,
        streamPrefix: "certbot",
        logRetention: logs.RetentionDays.ONE_MONTH
      }),
      environment: {
        APP_HOSTNAME: "tunnelvision.me",
        EMAIL: "admin@tunnelvision.me"
      }
    });

    // Mount Let's encrypt TLS certs to the nginx container
    server.addVolumesFrom({ sourceContainer: certbot.containerName, readOnly: true });

    // Docker container networking
    server.addPortMappings(
      {
        containerPort: 443,
        hostPort: 443
      },
      {
        containerPort: 22,
        hostPort: 22
      }
    );

    server.addContainerDependencies(
      {
        container: app
      },
      {
        container: certbot
      }
    );

    return taskDefinition;
  }

  get taskRole() {
    const policies = ["AWSServiceRoleForECS", "AmazonS3FullAccess"];

    const role = new iam.Role(this, "tunnelvision-role", {
      assumedBy: new iam.ServicePrincipal("ecs.amazonaws.com")
    });

    for (const policyName of policies) {
      const policy = iam.ManagedPolicy.fromAwsManagedPolicyName(policyName);
      role.addManagedPolicy(policy);
    }

    return role;
  }
}

function main() {
  const app = new cdk.App();
  const stack = new TunnelvisionStack(app);
  console.log(`Synthesizing ${stack.stackName}`);
  app.synth();
}

main();
