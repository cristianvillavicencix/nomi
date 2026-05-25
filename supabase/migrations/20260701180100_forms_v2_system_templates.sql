-- Seed system form templates (7 types)

insert into public.form_templates (org_id, slug, name, type, is_system, schema) values
(null, 'project_brief', 'Project Brief', 'project_brief', true,
'{
  "sections": [
    {
      "id": "context",
      "title": "Project Context",
      "fields": [
        {"key": "project_type", "type": "select", "label": "Project Type", "required": true,
         "options": ["new_website", "redesign", "ecommerce", "landing_page", "maintenance"]},
        {"key": "business_description", "type": "textarea", "label": "Describe your business", "required": true},
        {"key": "goals", "type": "textarea", "label": "Project goals", "required": true},
        {"key": "target_audience", "type": "text", "label": "Target audience"}
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
         "options": ["formal", "casual", "professional", "playful"]}
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
      "id": "technical",
      "title": "Technical Details",
      "fields": [
        {"key": "domain", "type": "url", "label": "Domain name"},
        {"key": "hosting", "type": "select", "label": "Hosting preference",
         "options": ["lbs_managed", "client_provided", "to_discuss"]},
        {"key": "cms_preference", "type": "select", "label": "CMS preference",
         "options": ["wordpress", "webflow", "custom", "no_preference"]}
      ]
    }
  ]
}'::jsonb),

(null, 'contact', 'Contact Form', 'contact', true,
'{
  "sections": [
    {
      "id": "main",
      "title": "Get in touch",
      "fields": [
        {"key": "name", "type": "text", "label": "Your name", "required": true},
        {"key": "email", "type": "email", "label": "Email", "required": true},
        {"key": "phone", "type": "phone", "label": "Phone"},
        {"key": "company", "type": "text", "label": "Company name"},
        {"key": "message", "type": "textarea", "label": "How can we help?", "required": true}
      ]
    }
  ]
}'::jsonb),

(null, 'lead_capture', 'Lead Capture', 'lead_capture', true,
'{
  "sections": [
    {
      "id": "main",
      "title": "",
      "fields": [
        {"key": "name", "type": "text", "label": "Name", "required": true},
        {"key": "email", "type": "email", "label": "Email", "required": true},
        {"key": "phone", "type": "phone", "label": "Phone"}
      ]
    }
  ]
}'::jsonb),

(null, 'quote_request', 'Quote Request', 'quote_request', true,
'{
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
        {"key": "project_description", "type": "textarea", "label": "Project description", "required": true}
      ]
    }
  ]
}'::jsonb),

(null, 'nps_survey', 'NPS Survey', 'nps_survey', true,
'{
  "sections": [
    {
      "id": "main",
      "title": "We value your feedback",
      "fields": [
        {"key": "nps_score", "type": "rating", "label": "How likely are you to recommend us?", "required": true,
         "min": 0, "max": 10, "labels": {"min": "Not at all", "max": "Extremely likely"}},
        {"key": "feedback", "type": "textarea", "label": "What is the main reason for your score?"},
        {"key": "what_can_we_improve", "type": "textarea", "label": "What can we improve?"}
      ]
    }
  ]
}'::jsonb),

(null, 'job_application', 'Job Application', 'job_application', true,
'{
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
        {"key": "resume", "type": "file", "label": "Resume / CV", "required": true,
         "accept": ".pdf,.doc,.docx"},
        {"key": "cover_letter", "type": "textarea", "label": "Cover letter"}
      ]
    }
  ]
}'::jsonb),

(null, 'generic_survey', 'Generic Survey', 'generic_survey', true,
'{
  "sections": [
    {
      "id": "main",
      "title": "Survey",
      "fields": [
        {"key": "respondent_name", "type": "text", "label": "Your name"},
        {"key": "respondent_email", "type": "email", "label": "Email"}
      ]
    }
  ]
}'::jsonb);
