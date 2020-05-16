import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as logs from "@aws-cdk/aws-logs";
import * as ecs from "@aws-cdk/aws-ecs";

interface TunnelvisionStackProps extends cdk.StackProps {
  buildDir: string;
}

class TunnelvisionStack extends cdk.Stack {
  buildDir: string;
  constructor(scope: cdk.Construct, props: TunnelvisionStackProps) {
    super(scope, "tunnelvision", {
      description: "tunnelvision.me",
      env: {
        account: process.env.AWS_ACCOUNT,
        region: process.env.AWS_DEFAULT_REGION
      }
    });
    this.buildDir = props.buildDir;
  }

  get service() {
    const service = new ecs.FargateService(this, "tunnelvision-service", {
      serviceName: "tunnelvision",
      cluster: this.cluster,
      taskDefinition: this.taskDefinition,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
      assignPublicIp: true
    });

    service.connections.allowFromAnyIpv4(ec2.Port.tcp(22), "Allow SSH");
    service.connections.allowFromAnyIpv4(ec2.Port.tcp(443), "Allow HTTPS");

    return service;
  }

  get cluster() {
    return new ecs.Cluster(this, "tunnelvision-cluster", {
      clusterName: "tunnelvision-cluster",
      vpc: ec2.Vpc.fromLookup(this, "default-vpc", {
        isDefault: true
      })
    });
  }

  get taskDefinition() {
    const taskDefinition = new ecs.FargateTaskDefinition(this, "tunnelvision-taskdefinition", {
      family: "tunnelvision",
      taskRole: this.taskRole
    });

    const exclude = ["node_modules", "cdk.out"];

    const logGroup = new logs.LogGroup(this, "tunnelvision-logs", {
      logGroupName: "tunnelvision.me",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const server = taskDefinition.addContainer("nginx", {
      image: ecs.ContainerImage.fromAsset(this.buildDir, {
        file: "Dockerfile.server",
        exclude
      }),
      logging: ecs.LogDriver.awsLogs({
        logGroup,
        streamPrefix: "server"
      })
    });

    const app = taskDefinition.addContainer("app", {
      image: ecs.ContainerImage.fromAsset(this.buildDir, {
        file: "Dockerfile.app",
        exclude
      }),
      logging: ecs.LogDriver.awsLogs({
        logGroup,
        streamPrefix: "app"
      }),
      environment: {
        MAX_CONNECTIONS: "50",
        FORCE_COLOR: "1",
        NODE_ENV: "production"
      },
      healthCheck: {
        command: ["sh", "/health.sh"]
      }
    });

    const certbot = taskDefinition.addContainer("certbot", {
      image: ecs.ContainerImage.fromAsset(this.buildDir, {
        file: "Dockerfile.certbot",
        exclude
      }),
      logging: ecs.LogDriver.awsLogs({
        logGroup,
        streamPrefix: "certbot"
      }),
      environment: {
        APP_HOSTNAME: "tunnelvision.me",
        EMAIL: "admin@tunnelvision.me"
      },
      healthCheck: {
        command: ["sh", "/health.sh"]
      }
    });

    // Container linking
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
        container: app,
        condition: ecs.ContainerDependencyCondition.HEALTHY
      },
      {
        container: certbot,
        condition: ecs.ContainerDependencyCondition.HEALTHY
      }
    );

    return taskDefinition;
  }

  get taskRole() {
    const policies = ["service-role/AmazonECSTaskExecutionRolePolicy", "AmazonS3FullAccess"];

    const role = new iam.Role(this, "tunnelvision-role", {
      roleName: "tunnelvision-role",
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com")
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
  const stack = new TunnelvisionStack(app, {
    buildDir: process.cwd()
  });
  console.log(`Synthesizing ${stack.stackName}`);
  console.log(`Service name: ${stack.service}`);
  app.synth();
}

main();
