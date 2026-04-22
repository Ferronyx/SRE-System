'use strict';

const { ec2_metrics }                                                                      = require('./ec2');
const { rds_metrics, rds_cluster_metrics }                                                 = require('./rds');
const { elb_metrics }                                                                      = require('./elb');
const { alb_metrics }                                                                      = require('./alb');
const { lambda_metrics }                                                                   = require('./lambda_metrics');
const { sqs_metrics }                                                                      = require('./sqs');
const { dynamodb_metrics }                                                                 = require('./dynamodb');
const { redis_metrics }                                                                    = require('./redis');
const { kafka_metrics, kafka_broker_metrics }                                              = require('./kafka');
const { ecs_metrics, ecs_service_metrics, ecs_instance_metrics, ecs_discovery_metrics }   = require('./ecs');
const { eks_container_insights_metrics }                                                   = require('./eks');
const { eks_service_container_insights_metrics, eks_namespace_container_insights_metrics } = require('./eks_service');
const { asg_metrics }                                                                      = require('./autoscaling_group');
const { cloudfront_metrics }                                                               = require('./cloudfront');
const { apigateway_metrics }                                                               = require('./apigateway');
const { appsync_metrics, appsync_resolver_metrics, appsync_datasource_metrics }           = require('./appsync');
const { dms_instance_metrics, dms_task_metrics }                                          = require('./dms');
const { docdb_metrics, docdb_cluster_metrics }                                             = require('./docdb');
const { kinesis_data_stream_metrics }                                                      = require('./kinesis');
const { memcached_metrics }                                                                = require('./memcached');
const { opensearch_metrics }                                                               = require('./opensearch');
const { rabbitmq_metrics, active_mq_metrics }                                             = require('./rabbitmq');
const { redshift_metrics, redshift_node_metrics }                                          = require('./redshift');
const { service_quota_metrics }                                                            = require('./service_quota');
const { ses_metrics }                                                                      = require('./ses');
const { waf_metrics, rulegroup_metrics, managedrulegroup_metrics }                        = require('./waf');
const { guard_duty_metrics }                                                               = require('./guarduty');

module.exports = {
  ec2_metrics,
  rds_metrics,
  rds_cluster_metrics,
  elb_metrics,
  alb_metrics,
  lambda_metrics,
  sqs_metrics,
  dynamodb_metrics,
  redis_metrics,
  kafka_metrics,
  kafka_broker_metrics,
  ecs_metrics,
  ecs_service_metrics,
  ecs_instance_metrics,
  ecs_discovery_metrics,
  eks_container_insights_metrics,
  eks_service_container_insights_metrics,
  eks_namespace_container_insights_metrics,
  asg_metrics,
  cloudfront_metrics,
  apigateway_metrics,
  appsync_metrics,
  appsync_resolver_metrics,
  appsync_datasource_metrics,
  dms_instance_metrics,
  dms_task_metrics,
  docdb_metrics,
  docdb_cluster_metrics,
  kinesis_data_stream_metrics,
  memcached_metrics,
  opensearch_metrics,
  rabbitmq_metrics,
  active_mq_metrics,
  redshift_metrics,
  redshift_node_metrics,
  service_quota_metrics,
  ses_metrics,
  waf_metrics,
  rulegroup_metrics,
  managedrulegroup_metrics,
  guard_duty_metrics,
};
