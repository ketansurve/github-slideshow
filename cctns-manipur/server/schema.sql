-- Suggested PostgreSQL schema for the Police Monitoring System.
-- Mirrors the JSON shapes in server/data/*.json one-to-one, so seeding
-- these tables from that JSON (or vice versa) is a straight column mapping.
-- Every table carries state_code so one database can serve many states -
-- add "WHERE state_code = $1" to the queries in db.js once you switch to
-- this schema (see the comment block at the top of db.js).

CREATE TABLE states (
  code        VARCHAR(4)  PRIMARY KEY,
  name        VARCHAR(80) NOT NULL
);

CREATE TABLE districts (
  code          VARCHAR(10) PRIMARY KEY,
  state_code    VARCHAR(4)  NOT NULL REFERENCES states(code),
  name          VARCHAR(80) NOT NULL
);

CREATE TABLE police_stations (
  code            VARCHAR(12) PRIMARY KEY,
  district_code   VARCHAR(10) NOT NULL REFERENCES districts(code),
  name            VARCHAR(80) NOT NULL
);

CREATE TABLE cases (
  id              SERIAL PRIMARY KEY,
  state_code      VARCHAR(4)  NOT NULL REFERENCES states(code),
  district        VARCHAR(80) NOT NULL,
  station         VARCHAR(80) NOT NULL,
  fir_no          VARCHAR(20) NOT NULL,
  fir_date        DATE        NOT NULL,
  sections        TEXT        NOT NULL,
  status          VARCHAR(40) NOT NULL,
  category        VARCHAR(40) NOT NULL,
  pending_days    INTEGER     NOT NULL DEFAULT 0
);

CREATE TABLE iif_forms (
  code        VARCHAR(10) PRIMARY KEY,
  state_code  VARCHAR(4)  NOT NULL REFERENCES states(code),
  name        VARCHAR(120) NOT NULL,
  record_count INTEGER    NOT NULL DEFAULT 0,
  health      VARCHAR(20) NOT NULL -- Complete | Attention | Weak
);

CREATE TABLE officers (
  id              SERIAL PRIMARY KEY,
  state_code      VARCHAR(4)  NOT NULL REFERENCES states(code),
  name            VARCHAR(80) NOT NULL,
  station         VARCHAR(80) NOT NULL,
  district        VARCHAR(80) NOT NULL,
  assigned        INTEGER NOT NULL DEFAULT 0,
  chargesheeted   INTEGER NOT NULL DEFAULT 0,
  pending         INTEGER NOT NULL DEFAULT 0,
  beyond_90       INTEGER NOT NULL DEFAULT 0,
  disposal_pct    NUMERIC(5,1) NOT NULL DEFAULT 0,
  quality_index   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE icjs_pillars (
  id          SERIAL PRIMARY KEY,
  state_code  VARCHAR(4)  NOT NULL REFERENCES states(code),
  pillar      VARCHAR(80) NOT NULL,
  exchange    VARCHAR(120) NOT NULL,
  ack_rate    VARCHAR(10)  NOT NULL,
  health      VARCHAR(10)  NOT NULL -- good | watch | action
);

CREATE TABLE cctv_feeds (
  id          SERIAL PRIMARY KEY,
  state_code  VARCHAR(4)  NOT NULL REFERENCES states(code),
  station     VARCHAR(80) NOT NULL,
  location    VARCHAR(80) NOT NULL,
  status      VARCHAR(10) NOT NULL -- up | down
);

-- Aggregate/reporting views (dashboard KPIs, analytics, NCLI, quality,
-- project status) are computed from the tables above in a production
-- system, typically via materialized views or a nightly ETL job. The demo
-- seeds them directly as JSON (server/data/dashboard.json, analytics.json,
-- ncl.json, quality.json, projects.json) so the front-end has numbers to
-- render without building that pipeline first.
