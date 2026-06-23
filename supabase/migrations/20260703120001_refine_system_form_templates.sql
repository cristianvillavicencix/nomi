-- Refine system form templates with additional fields and sections (Part C.1)

update public.form_templates
set schema = '{
  "sections": [
    {
      "id": "context",
      "title": "Project Context",
      "fields": [
        {"key": "project_type", "type": "select", "label": "Project Type", "required": true,
         "options": ["new_website", "redesign", "ecommerce", "landing_page", "maintenance"]},
        {"key": "business_description", "type": "textarea", "label": "Describe your business", "required": true},
        {"key": "goals", "type": "textarea", "label": "Project goals", "required": true},
        {"key": "target_audience", "type": "text", "label": "Target audience"},
        {"key": "existing_website", "type": "url", "label": "Current website"}
      ]
    },
    {
      "id": "brand",
      "title": "Brand & Content",
      "visible_when": {"project_type": ["new_website", "redesign", "landing_page", "ecommerce"]},
      "fields": [
        {"key": "logo_files", "type": "file_multi", "label": "Logo files"},
        {"key": "brand_colors", "type": "text", "label": "Brand colors (hex codes)"},
        {"key": "brand_fonts", "type": "text", "label": "Brand fonts"},
        {"key": "tone", "type": "select", "label": "Tone of voice",
         "options": ["formal", "casual", "professional", "playful"]},
        {"key": "design_references", "type": "textarea", "label": "Design references"}
      ]
    },
    {
      "id": "scope",
      "title": "Pages & Sections",
      "visible_when": {"project_type": ["new_website", "redesign"]},
      "fields": [
        {"key": "pages_needed", "type": "textarea", "label": "List pages needed"},
        {"key": "must_have_features", "type": "textarea", "label": "Must-have features"}
      ]
    },
    {
      "id": "redesign",
      "title": "Redesign & Migration",
      "visible_when": {"project_type": "redesign"},
      "fields": [
        {"key": "redirects_map", "type": "textarea", "label": "URL redirects (old → new)"},
        {"key": "preserve_urls", "type": "textarea", "label": "URLs that must not change"},
        {"key": "analytics_ids", "type": "textarea", "label": "Analytics & Search Console IDs"}
      ]
    },
    {
      "id": "ecommerce",
      "title": "E-commerce",
      "visible_when": {"project_type": "ecommerce"},
      "fields": [
        {"key": "products_overview", "type": "textarea", "label": "Products / catalog"},
        {"key": "payment_methods", "type": "text", "label": "Payment methods"},
        {"key": "shipping_setup", "type": "textarea", "label": "Shipping & fulfillment"},
        {"key": "tax_setup", "type": "text", "label": "Tax setup"}
      ]
    },
    {
      "id": "technical",
      "title": "Technical Details",
      "fields": [
        {"key": "domain", "type": "url", "label": "Domain name"},
        {"key": "hosting", "type": "select", "label": "Hosting preference",
         "options": ["lbs_managed", "client_provided", "to_discuss"]},
        {"key": "cms_preference", "type": "select", "label": "CMS preference",
         "options": ["wordpress", "webflow", "custom", "no_preference"]}
      ]
    },
    {
      "id": "seo",
      "title": "SEO & Local Presence",
      "fields": [
        {"key": "social_links", "type": "textarea", "label": "Social profile links"},
        {"key": "google_business_profile", "type": "url", "label": "Google Business Profile"},
        {"key": "local_keywords", "type": "textarea", "label": "Priority keywords / local terms"}
      ]
    },
    {
      "id": "process",
      "title": "Process & Notes",
      "fields": [
        {"key": "approval_contact", "type": "text", "label": "Who approves design & content?"},
        {"key": "out_of_scope", "type": "textarea", "label": "Out of scope"},
        {"key": "client_notes", "type": "textarea", "label": "Additional notes"}
      ]
    }
  ]
}'::jsonb,
updated_at = now()
where is_system = true and slug = 'project_brief';

update public.form_templates
set schema = '{
  "sections": [
    {
      "id": "main",
      "title": "Get in touch",
      "fields": [
        {"key": "name", "type": "text", "label": "Your name", "required": true},
        {"key": "email", "type": "email", "label": "Email", "required": true},
        {"key": "phone", "type": "phone", "label": "Phone"},
        {"key": "company", "type": "text", "label": "Company name"},
        {"key": "preferred_contact_method", "type": "select", "label": "Preferred contact method",
         "options": ["email", "phone", "sms", "whatsapp"]},
        {"key": "best_time_to_contact", "type": "select", "label": "Best time to contact",
         "options": ["morning", "afternoon", "evening"]},
        {"key": "message", "type": "textarea", "label": "How can we help?", "required": true}
      ]
    }
  ]
}'::jsonb,
updated_at = now()
where is_system = true and slug = 'contact';

update public.form_templates
set schema = '{
  "sections": [
    {
      "id": "main",
      "title": "",
      "fields": [
        {"key": "source", "type": "hidden", "label": "Source"},
        {"key": "name", "type": "text", "label": "Name", "required": true},
        {"key": "email", "type": "email", "label": "Email", "required": true},
        {"key": "phone", "type": "phone", "label": "Phone"},
        {"key": "interest_in", "type": "select", "label": "Interested in",
         "options": ["web_design", "seo", "ads", "maintenance", "other"]}
      ]
    }
  ]
}'::jsonb,
updated_at = now()
where is_system = true and slug = 'lead_capture';

update public.form_templates
set schema = '{
  "sections": [
    {
      "id": "project",
      "title": "Tell us about your project",
      "fields": [
        {"key": "name", "type": "text", "label": "Your name", "required": true},
        {"key": "email", "type": "email", "label": "Email", "required": true},
        {"key": "phone", "type": "phone", "label": "Phone"},
        {"key": "service_type", "type": "select", "label": "Service needed", "required": true,
         "options": ["website_design", "ecommerce", "landing_page", "seo", "maintenance", "other"]},
        {"key": "budget_range", "type": "select", "label": "Budget range",
         "options": ["under_2k", "2k_5k", "5k_10k", "10k_25k", "25k_plus"]},
        {"key": "timeline", "type": "select", "label": "Timeline",
         "options": ["asap", "1_month", "2_3_months", "flexible"]},
        {"key": "urgency", "type": "select", "label": "Urgency",
         "options": ["today", "this_week", "this_month", "flexible"]},
        {"key": "referral_source", "type": "text", "label": "How did you hear about us?"},
        {"key": "project_description", "type": "textarea", "label": "Project description", "required": true}
      ]
    }
  ]
}'::jsonb,
updated_at = now()
where is_system = true and slug = 'quote_request';

update public.form_templates
set schema = '{
  "sections": [
    {
      "id": "main",
      "title": "We value your feedback",
      "fields": [
        {"key": "nps_score", "type": "rating", "label": "How likely are you to recommend us?", "required": true,
         "min": 0, "max": 10, "labels": {"min": "Not at all", "max": "Extremely likely"}},
        {"key": "would_recommend", "type": "radio", "label": "Would you recommend us?",
         "options": ["yes", "no", "maybe"]},
        {"key": "feedback", "type": "textarea", "label": "What is the main reason for your score?"},
        {"key": "what_can_we_improve", "type": "textarea", "label": "What can we improve?"},
        {"key": "permission_to_use_quote", "type": "checkbox", "label": "Allow us to use your feedback in marketing"}
      ]
    }
  ]
}'::jsonb,
updated_at = now()
where is_system = true and slug = 'nps_survey';

update public.form_templates
set schema = '{
  "sections": [
    {
      "id": "personal",
      "title": "Personal Information",
      "fields": [
        {"key": "full_name", "type": "text", "label": "Full name", "required": true},
        {"key": "email", "type": "email", "label": "Email", "required": true},
        {"key": "phone", "type": "phone", "label": "Phone", "required": true},
        {"key": "location", "type": "text", "label": "Location (city, state)"},
        {"key": "linkedin_url", "type": "url", "label": "LinkedIn profile"}
      ]
    },
    {
      "id": "experience",
      "title": "Experience",
      "fields": [
        {"key": "position_applying", "type": "text", "label": "Position applying for", "required": true},
        {"key": "years_experience", "type": "number", "label": "Years of experience"},
        {"key": "desired_salary", "type": "text", "label": "Desired salary (optional)"},
        {"key": "start_date_availability", "type": "date", "label": "Earliest start date"},
        {"key": "resume", "type": "file", "label": "Resume / CV", "required": true,
         "accept": ".pdf,.doc,.docx"},
        {"key": "cover_letter", "type": "textarea", "label": "Cover letter"},
        {"key": "references_optional", "type": "textarea", "label": "References (optional)"}
      ]
    }
  ]
}'::jsonb,
updated_at = now()
where is_system = true and slug = 'job_application';

-- generic_survey unchanged (Part C.1.7)
