--
-- PostgreSQL database dump
--

-- Dumped from database version 12.6 (Ubuntu 12.6-0ubuntu0.20.04.1)
-- Dumped by pg_dump version 12.6 (Ubuntu 12.6-0ubuntu0.20.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: blacklisted_guilds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blacklisted_guilds (
    id character varying(18) NOT NULL,
    reason character varying(280)
);


--
-- Name: user_location_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_location_subscriptions (
    id character varying(18) NOT NULL,
    zip character varying(5) NOT NULL,
    radius smallint DEFAULT 15 NOT NULL,
    second_dose boolean DEFAULT false NOT NULL,
    state character varying(2) NOT NULL,
    dm_channel_id character varying(18) NOT NULL,
    paused boolean DEFAULT false NOT NULL,
    provider_whitelist character varying(100)[],
    provider_blacklist character varying(100)[]
);


--
-- Name: user_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notifications (
    id character varying(18) NOT NULL,
    location_id character varying(10) NOT NULL,
    sent_timestamp timestamp with time zone NOT NULL,
    appointments_last_modified timestamp with time zone NOT NULL
);


--
-- Name: blacklisted_guilds blacklisted_guilds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blacklisted_guilds
    ADD CONSTRAINT blacklisted_guilds_pkey PRIMARY KEY (id);


--
-- Name: user_location_subscriptions user_location_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_location_subscriptions
    ADD CONSTRAINT user_location_subscriptions_pkey PRIMARY KEY (id, zip);


--
-- Name: user_notifications user_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id, location_id);


--
-- PostgreSQL database dump complete
--

