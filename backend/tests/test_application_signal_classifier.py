from daily_dashboard.application_signals import EmailEnvelope, classify_email


def email(subject, snippet, sender="no-reply@example.com"):
    return EmailEnvelope(
        message_id="one",
        thread_id="",
        sender=sender,
        subject=subject,
        snippet=snippet,
        body="",
        received_at="2026-07-17T09:00:00-07:00",
        source_url="",
    )


def test_provider_domains_are_not_mistaken_for_companies():
    salesforce = classify_email(email(
        "We Received Your Application for the Summer 2027 Intern - APM Position",
        "You applied for the Associate Product Manager opening at Salesforce.",
        "salesforce@myworkday.com",
    ), [])
    anthropic = classify_email(email(
        "We received your Claude Corps application",
        "Your application is in.",
        "no-reply@us.greenhouse-mail.io",
    ), [])

    assert salesforce.company == "Salesforce"
    assert anthropic.company == "Anthropic"
    assert anthropic.role_hint == "Claude Corps"
    assert anthropic.signal_type == "confirmation"


def test_company_in_subject_stops_before_following_email_context():
    chubb = classify_email(email(
        "Update on your application to Chubb",
        "For the AI Engineer Intern position, we decided to pursue other candidates.",
        "Chubb Talent Acquisition",
    ), [])

    assert chubb.company == "Chubb"
    assert chubb.role_hint == "AI Engineer Intern"
    assert chubb.signal_type == "rejection"


def test_status_update_role_is_extracted_for_manual_review():
    amazon = classify_email(email(
        "Amazon application: Status update",
        "Status update for Software Development Engineer, AWS Agentic AI.",
        "noreply@mail.amazon.jobs",
    ), [])

    assert amazon.company == "Amazon"
    assert amazon.role_hint == "Software Development Engineer, AWS Agentic AI"
    assert amazon.signal_type == "status_update"


def test_applying_to_subject_extracts_company_and_clean_role():
    adobe = classify_email(EmailEnvelope(
        message_id="adobe-rejection",
        thread_id="",
        sender="do-not-reply adobe <adobe@myworkday.com>",
        subject="Thank you for Applying to Adobe",
        snippet="Thank you for taking the time to apply.",
        body=(
            "Hi Chi, Thank you for taking the time to apply for the "
            "R160919 2026 Intern - Applied Science/Machine Learning Engineer role. "
            "Unfortunately, we are moving forward with other candidates."
        ),
        received_at="2026-07-17T09:00:00-07:00",
        source_url="",
    ), [])
    scale = classify_email(email(
        "Thank you for applying to Scale AI",
        "Your application has been received and we will review it right away.",
        "no-reply@us.greenhouse-mail.io",
    ), [])

    assert adobe.company == "Adobe"
    assert adobe.role_hint == "2026 Intern - Applied Science/Machine Learning Engineer"
    assert scale.company == "Scale AI"
    assert scale.role_hint == "Role from Gmail"
