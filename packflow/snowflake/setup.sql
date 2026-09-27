use role accountadmin;

create warehouse if not exists packflow_wh
  warehouse_size = xsmall
  auto_suspend = 60
  auto_resume = true
  initially_suspended = true;

create database if not exists packflow_analytics;
create schema if not exists packflow_analytics.public;

create role if not exists packflow_analytics_role;
grant role packflow_analytics_role to role sysadmin;

grant usage on warehouse packflow_wh to role packflow_analytics_role;
grant usage on database packflow_analytics to role packflow_analytics_role;
grant usage on schema packflow_analytics.public to role packflow_analytics_role;

create table if not exists packflow_analytics.public.packflow_events (
  event_id varchar(36) default uuid_string() not null,
  event_type varchar(64) not null,
  tracking_number varchar(64),
  stop_number number(38, 0),
  zone varchar(8),
  shelf varchar(16),
  slot number(38, 0),
  payload variant,
  event_timestamp timestamp_ntz default current_timestamp() not null,
  constraint packflow_events_pk primary key (event_id)
);

grant select, insert on table packflow_analytics.public.packflow_events
  to role packflow_analytics_role;

create user if not exists packflow_analytics_user
  type = service
  default_role = packflow_analytics_role
  default_warehouse = packflow_wh
  default_namespace = packflow_analytics.public;

alter user packflow_analytics_user set
  default_role = packflow_analytics_role
  default_warehouse = packflow_wh
  default_namespace = packflow_analytics.public;

grant role packflow_analytics_role to user packflow_analytics_user;

-- alter user packflow_analytics_user set rsa_public_key = '<paste_public_key_body_here>';

show grants to user packflow_analytics_user;
