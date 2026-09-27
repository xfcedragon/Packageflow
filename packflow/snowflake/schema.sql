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
