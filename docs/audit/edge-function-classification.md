# Edge function JWT classification

Native `verify_jwt` stays **off** for webhooks, public links, and cron.
`AuthMiddleware` already verifies Bearer on session functions.
Do not flip `verify_jwt = true` on a session function until its caller is proven to send a user JWT (cron and custom `Authorization` headers will 401).

Counted **109** functions in `supabase/config.toml`.

Live `SECURITY DEFINER` functions in `public`: **110**. All have a fixed `search_path` (Advisor-clean on that axis). Helpers stay `REVOKE`d from `anon`/`authenticated` using the phase-1 advisor migrations.

| Kind | Count | Native JWT |
|---|---|---|
| public | 26 | off |
| webhook | 13 | off forever |
| cron | 14 | off (service role / pg_cron) |
| session | 56 | candidate only |

| Function | Class |
|---|---|
| `merge_contacts` | session |
| `postmark` | webhook |
| `email_inbound` | webhook |
| `reply_ticket` | session |
| `merge_tickets` | session |
| `move_ticket_messages` | session |
| `update_password` | session |
| `users` | session |
| `stripe-webhook` | webhook |
| `stripe-billing` | session |
| `platform-directory` | session |
| `accept_proposal` | public |
| `send_proposal` | session |
| `get_public_proposal` | public |
| `sign_proposal_contract` | public |
| `pay_proposal_deposit` | public |
| `stripe-client-webhook` | webhook |
| `create_client_subscription` | session |
| `prepare_client_subscription_payment` | session |
| `manage_client_subscription` | session |
| `process_scheduled_payments` | cron |
| `issue_client_invoice` | session |
| `create_client_invoice` | session |
| `update_client_invoice` | session |
| `send_client_invoice` | session |
| `schedule_client_invoice` | session |
| `manage_client_invoice` | session |
| `process_scheduled_client_invoices` | cron |
| `share_client_invoice` | session |
| `get_public_invoice` | public |
| `get_public_subscription_setup` | public |
| `get_public_subscription_agreement` | public |
| `get_public_subscription_agreement_documents` | public |
| `sign_subscription_agreement` | public |
| `pay_client_invoice` | public |
| `prepare_client_invoice_payment` | session |
| `process_invoice_auto_charges` | cron |
| `process_invoice_payment_reminders` | cron |
| `process_missed_invoice_payment_receipts` | cron |
| `resend_client_invoice_payment_receipt` | session |
| `charge_client_invoice_on_file` | session |
| `send_client_invoice_payment_link` | session |
| `send_meeting_link` | session |
| `notify_meeting_scheduled` | session |
| `get_public_calendar_event` | public |
| `get_public_deal_brief` | public |
| `get_github_repo_status` | public |
| `messaging_settings` | session |
| `email_settings` | session |
| `stripe_settings` | session |
| `ticket_settings` | session |
| `import_ticket_email` | session |
| `check_ticket_inbound_pipeline` | webhook |
| `process_ticket_automations` | cron |
| `access_entry_password` | session |
| `client_portal` | public |
| `deliver_project` | session |
| `client_portal_credentials` | public |
| `send_client_sms` | session |
| `twilio_inbound_sms` | webhook |
| `telnyx_inbound_sms` | webhook |
| `telnyx_sms_status` | webhook |
| `marketing_campaigns` | session |
| `process_marketing_campaigns` | cron |
| `marketing_unsubscribe` | public |
| `twilio_sms_status` | webhook |
| `voice_twiml` | webhook |
| `voice_token` | session |
| `voice_status_webhook` | webhook |
| `voice_inbound` | webhook |
| `submit_form_v2` | public |
| `get_form_by_token` | public |
| `generate_form_token` | session |
| `resolve_short_code` | public |
| `forms_embed_js` | public |
| `record_form_event` | public |
| `upload_form_file` | public |
| `generate_booking_link` | session |
| `get_public_booking` | public |
| `submit_public_booking` | public |
| `notify_follow_up` | cron |
| `send_calendar_reminders` | cron |
| `calendar_feed` | public |
| `website_monitor_check` | cron |
| `website_monitor_run` | cron |
| `website_monitor_sync` | cron |
| `website_monitor_run_org` | session |
| `website_monitor_create` | session |
| `website_audit_enqueue` | session |
| `website_audit_callback` | webhook |
| `website_audit_send` | session |
| `website_audit_summarize` | session |
| `website_audit_schedule` | cron |
| `google_gsc` | session |
| `google_places` | session |
| `ingest_lbs_lead` | public |
| `hostinger_settings` | session |
| `hostinger_sync` | session |
| `hostinger_availability` | session |
| `hostinger_sync_cron` | cron |
| `crm_assistant` | session |
| `hostinger_domain_details` | session |
| `mail_oauth` | session |
| `mail_sync` | session |
| `mail_send` | session |
| `mail_actions` | session |
| `mail_imap` | session |
| `mail_account_shares` | session |
| `file_download` | session |
