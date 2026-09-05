-- Create a function to handle contact upsert logic
-- Phone is primary identifier, email is secondary
CREATE OR REPLACE FUNCTION public.upsert_customer_contact(
  p_restaurant_id UUID,
  p_order_id UUID,
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_consent_given BOOLEAN DEFAULT FALSE,
  p_total_spend NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id UUID;
  v_normalized_phone TEXT;
BEGIN
  -- Normalize phone number (remove spaces, keep only digits and +)
  v_normalized_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9+]', '', 'g');
  IF v_normalized_phone = '' THEN
    v_normalized_phone := NULL;
  END IF;

  -- First, try to find existing contact by phone (primary identifier)
  IF v_normalized_phone IS NOT NULL THEN
    SELECT id INTO v_contact_id
    FROM customer_contacts
    WHERE restaurant_id = p_restaurant_id
      AND phone IS NOT NULL
      AND regexp_replace(phone, '[^0-9+]', '', 'g') = v_normalized_phone
    LIMIT 1;
  END IF;

  -- If not found by phone, try by email (secondary identifier)
  IF v_contact_id IS NULL AND p_email IS NOT NULL AND p_email != '' THEN
    SELECT id INTO v_contact_id
    FROM customer_contacts
    WHERE restaurant_id = p_restaurant_id
      AND LOWER(email) = LOWER(p_email)
    LIMIT 1;
  END IF;

  -- If contact exists, update it
  IF v_contact_id IS NOT NULL THEN
    UPDATE customer_contacts
    SET 
      name = COALESCE(p_name, name),
      phone = COALESCE(v_normalized_phone, phone),
      email = COALESCE(NULLIF(p_email, ''), email),
      visit_count = visit_count + 1,
      total_spend = total_spend + COALESCE(p_total_spend, 0),
      consent_given = CASE WHEN p_consent_given THEN TRUE ELSE consent_given END,
      consent_timestamp = CASE WHEN p_consent_given THEN NOW() ELSE consent_timestamp END
    WHERE id = v_contact_id;
    
    RETURN v_contact_id;
  END IF;

  -- Create new contact only if we have at least phone or email
  IF v_normalized_phone IS NOT NULL OR (p_email IS NOT NULL AND p_email != '') THEN
    INSERT INTO customer_contacts (
      restaurant_id,
      order_id,
      name,
      phone,
      email,
      consent_given,
      consent_timestamp,
      total_spend,
      visit_count
    ) VALUES (
      p_restaurant_id,
      p_order_id,
      p_name,
      v_normalized_phone,
      NULLIF(p_email, ''),
      p_consent_given,
      CASE WHEN p_consent_given THEN NOW() ELSE NULL END,
      COALESCE(p_total_spend, 0),
      1
    )
    RETURNING id INTO v_contact_id;
    
    RETURN v_contact_id;
  END IF;

  RETURN NULL;
END;
$$;

-- Create index to speed up lookups
CREATE INDEX IF NOT EXISTS idx_customer_contacts_phone_restaurant 
ON customer_contacts (restaurant_id, phone) 
WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_contacts_email_restaurant 
ON customer_contacts (restaurant_id, email) 
WHERE email IS NOT NULL;