-- Project Atelier P2 discovery, content, search, and file foundations
-- Owners: Catalog and Search, CMS and Localization, Files and Media
-- Risk class: D (publication/RLS/file isolation) with additive class A tables
-- Transaction-safe: yes; the migration runner applies this file atomically
-- Expected lock: extension catalog and new-object catalog locks only
-- Recovery: discard an uncommitted transaction; after commit, forward-fix only

select pg_advisory_xact_lock(hashtextextended('project-atelier:p2-discovery-content-files', 0));

create schema if not exists extensions;
revoke all on schema extensions from public;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists cms;
create schema if not exists catalog;
create schema if not exists files;

revoke all on schema cms, catalog, files from public;

create table cms.localized_resources (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in (
    'PRODUCT', 'CATEGORY', 'COLLECTION', 'MATERIAL', 'COLOR',
    'PRODUCT_OPTION', 'PRODUCT_OPTION_VALUE', 'CMS_CONTENT'
  )),
  current_ar_revision_id uuid,
  current_en_revision_id uuid,
  created_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1)
);

create table cms.translation_revisions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references cms.localized_resources(id) on delete restrict,
  locale text not null check (locale in ('ar', 'en')),
  revision_number integer not null check (revision_number >= 1),
  lifecycle text not null check (lifecycle in ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED')),
  content_schema_version integer not null check (content_schema_version >= 1),
  content_json jsonb not null check (jsonb_typeof(content_json) = 'object'),
  source_arabic_revision_id uuid references cms.translation_revisions(id) on delete restrict,
  prior_revision_id uuid references cms.translation_revisions(id) on delete restrict,
  stale_source boolean not null default false,
  content_digest text not null check (content_digest ~ '^[0-9a-f]{64}$'),
  authored_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  reviewed_by_principal_id uuid references iam.principals(id) on delete restrict,
  approved_by_principal_id uuid references iam.principals(id) on delete restrict,
  published_by_principal_id uuid references iam.principals(id) on delete restrict,
  review_note text,
  reviewed_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint translation_revisions_sequence_unique unique (resource_id, locale, revision_number),
  constraint translation_revisions_prior_not_self check (prior_revision_id is distinct from id),
  constraint translation_revisions_source_check check (
    (locale = 'ar' and source_arabic_revision_id is null and not stale_source)
    or (locale = 'en' and source_arabic_revision_id is not null)
  ),
  constraint translation_revisions_attribution_check check (
    (lifecycle = 'DRAFT' and approved_by_principal_id is null and published_by_principal_id is null)
    or (lifecycle = 'IN_REVIEW' and reviewed_by_principal_id is not null
      and reviewed_at is not null and approved_by_principal_id is null
      and published_by_principal_id is null)
    or (lifecycle = 'APPROVED' and reviewed_by_principal_id is not null
      and reviewed_at is not null and approved_by_principal_id is not null
      and approved_at is not null and published_by_principal_id is null)
    or (lifecycle = 'PUBLISHED' and reviewed_by_principal_id is not null
      and reviewed_at is not null and approved_by_principal_id is not null
      and approved_at is not null and published_by_principal_id is not null
      and published_at is not null)
  )
);

alter table cms.localized_resources
  add constraint localized_resources_current_ar_fk
  foreign key (current_ar_revision_id) references cms.translation_revisions(id) on delete restrict,
  add constraint localized_resources_current_en_fk
  foreign key (current_en_revision_id) references cms.translation_revisions(id) on delete restrict;

create index translation_revisions_resource_locale_idx
  on cms.translation_revisions(resource_id, locale, revision_number desc);

create table cms.contents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'HOME', 'ABOUT', 'CONTACT', 'FAQ', 'PRIVACY_POLICY',
    'TERMS_AND_CONDITIONS', 'WARRANTY_INFORMATION', 'CUSTOM_PAGE'
  )),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) <= 120),
  visibility text not null default 'DRAFT' check (visibility in ('DRAFT', 'PUBLISHED', 'HIDDEN')),
  current_published_version_id uuid,
  created_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  updated_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint contents_slug_unique unique (slug)
);

create table cms.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references cms.contents(id) on delete restrict,
  revision_number integer not null check (revision_number >= 1),
  block_schema_version integer not null check (block_schema_version >= 1),
  blocks_json jsonb not null check (jsonb_typeof(blocks_json) = 'array'),
  localized_resource_id uuid not null unique
    references cms.localized_resources(id) on delete restrict,
  lifecycle text not null check (lifecycle in ('DRAFT', 'PUBLISHED')),
  content_digest text not null check (content_digest ~ '^[0-9a-f]{64}$'),
  prior_version_id uuid references cms.content_versions(id) on delete restrict,
  created_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  published_by_principal_id uuid references iam.principals(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint content_versions_sequence_unique unique (content_id, revision_number),
  constraint content_versions_prior_not_self check (prior_version_id is distinct from id),
  constraint content_versions_publication_check check (
    (lifecycle = 'DRAFT' and published_by_principal_id is null and published_at is null)
    or (lifecycle = 'PUBLISHED' and published_by_principal_id is not null and published_at is not null)
  )
);

alter table cms.contents
  add constraint contents_current_published_version_fk
  foreign key (current_published_version_id) references cms.content_versions(id) on delete restrict;

create index content_versions_content_idx
  on cms.content_versions(content_id, revision_number desc);

create function cms.protect_immutable_translation_revision()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.lifecycle in ('APPROVED', 'PUBLISHED') then
    raise exception using errcode = '55000', message = 'approved and published translation revisions are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

create trigger translation_revisions_immutable
before update or delete on cms.translation_revisions
for each row execute function cms.protect_immutable_translation_revision();

create function cms.protect_immutable_content_version()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.lifecycle = 'PUBLISHED' then
    raise exception using errcode = '55000', message = 'published content versions are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

create trigger content_versions_immutable
before update or delete on cms.content_versions
for each row execute function cms.protect_immutable_content_version();

create function cms.validate_localized_resource_pointers()
returns trigger
language plpgsql
set search_path = pg_catalog, cms
as $$
begin
  if new.current_ar_revision_id is not null and not exists (
    select 1 from cms.translation_revisions t
    where t.id = new.current_ar_revision_id and t.resource_id = new.id
      and t.locale = 'ar' and t.lifecycle = 'PUBLISHED' and not t.stale_source
  ) then
    raise exception using errcode = '23514', message = 'current Arabic translation must be a published revision for this resource';
  end if;
  if new.current_en_revision_id is not null and not exists (
    select 1 from cms.translation_revisions t
    where t.id = new.current_en_revision_id and t.resource_id = new.id
      and t.locale = 'en' and t.lifecycle = 'PUBLISHED' and not t.stale_source
      and t.source_arabic_revision_id = new.current_ar_revision_id
  ) then
    raise exception using errcode = '23514', message = 'current English translation must match the current Arabic source';
  end if;
  return new;
end
$$;

create trigger localized_resource_pointer_guard
before insert or update on cms.localized_resources
for each row execute function cms.validate_localized_resource_pointers();

create function cms.validate_content_pointer()
returns trigger
language plpgsql
set search_path = pg_catalog, cms
as $$
begin
  if new.visibility = 'PUBLISHED' and (
    new.current_published_version_id is null or not exists (
      select 1 from cms.content_versions v
      where v.id = new.current_published_version_id
        and v.content_id = new.id and v.lifecycle = 'PUBLISHED'
    )
  ) then
    raise exception using errcode = '23514', message = 'published content requires its own published version';
  end if;
  return new;
end
$$;

create trigger content_pointer_guard
before insert or update on cms.contents
for each row execute function cms.validate_content_pointer();

revoke all on function cms.protect_immutable_translation_revision() from public;
revoke all on function cms.protect_immutable_content_version() from public;
revoke all on function cms.validate_localized_resource_pointers() from public;
revoke all on function cms.validate_content_pointer() from public;

create table catalog.categories (
  id uuid primary key default gen_random_uuid(),
  localized_resource_id uuid not null unique
    references cms.localized_resources(id) on delete restrict,
  lifecycle text not null default 'DRAFT'
    check (lifecycle in ('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  updated_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1)
);

create table catalog.collections (
  id uuid primary key default gen_random_uuid(),
  localized_resource_id uuid not null unique
    references cms.localized_resources(id) on delete restrict,
  lifecycle text not null default 'DRAFT'
    check (lifecycle in ('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  updated_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1)
);

create table catalog.products (
  id uuid primary key default gen_random_uuid(),
  localized_resource_id uuid not null unique
    references cms.localized_resources(id) on delete restrict,
  category_id uuid not null references catalog.categories(id) on delete restrict,
  furniture_type text not null check (length(trim(furniture_type)) between 1 and 80),
  lifecycle text not null default 'DRAFT' check (lifecycle in (
    'DRAFT', 'PUBLISHED', 'HIDDEN', 'TEMPORARILY_UNAVAILABLE', 'ARCHIVED'
  )),
  starting_amount_minor bigint not null check (starting_amount_minor >= 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  production_information text,
  created_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  updated_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint products_publication_check check (
    (lifecycle = 'PUBLISHED' and published_at is not null) or lifecycle <> 'PUBLISHED'
  )
);

create table catalog.product_collections (
  product_id uuid not null references catalog.products(id) on delete restrict,
  collection_id uuid not null references catalog.collections(id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default clock_timestamp(),
  primary key (product_id, collection_id)
);

create table catalog.materials (
  id uuid primary key default gen_random_uuid(),
  localized_resource_id uuid not null unique
    references cms.localized_resources(id) on delete restrict,
  lifecycle text not null default 'DRAFT'
    check (lifecycle in ('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED')),
  created_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  updated_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1)
);

create table catalog.colors (
  id uuid primary key default gen_random_uuid(),
  localized_resource_id uuid not null unique
    references cms.localized_resources(id) on delete restrict,
  display_value text not null check (
    display_value ~ '^#[0-9A-Fa-f]{6}$' or length(trim(display_value)) between 1 and 80
  ),
  lifecycle text not null default 'DRAFT'
    check (lifecycle in ('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED')),
  created_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  updated_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1)
);

create table catalog.product_materials (
  product_id uuid not null references catalog.products(id) on delete restrict,
  material_id uuid not null references catalog.materials(id) on delete restrict,
  available boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default clock_timestamp(),
  primary key (product_id, material_id)
);

create table catalog.product_colors (
  product_id uuid not null references catalog.products(id) on delete restrict,
  color_id uuid not null references catalog.colors(id) on delete restrict,
  available boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default clock_timestamp(),
  primary key (product_id, color_id)
);

create table catalog.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references catalog.products(id) on delete restrict,
  localized_resource_id uuid not null unique
    references cms.localized_resources(id) on delete restrict,
  option_kind text not null check (option_kind in ('SINGLE_CHOICE', 'MULTI_CHOICE')),
  required boolean not null default false,
  lifecycle text not null default 'DRAFT'
    check (lifecycle in ('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  updated_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1)
);

create table catalog.product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references catalog.product_options(id) on delete restrict,
  localized_resource_id uuid not null unique
    references cms.localized_resources(id) on delete restrict,
  machine_value text not null check (machine_value ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  available boolean not null default true,
  lifecycle text not null default 'DRAFT'
    check (lifecycle in ('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  updated_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint product_option_values_machine_unique unique (option_id, machine_value)
);

create table catalog.product_option_exclusions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references catalog.products(id) on delete restrict,
  left_value_id uuid not null references catalog.product_option_values(id) on delete restrict,
  right_value_id uuid not null references catalog.product_option_values(id) on delete restrict,
  created_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  constraint product_option_exclusions_canonical check (left_value_id < right_value_id),
  constraint product_option_exclusions_unique unique (product_id, left_value_id, right_value_id)
);

create table catalog.product_option_dependencies (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references catalog.products(id) on delete restrict,
  selected_value_id uuid not null references catalog.product_option_values(id) on delete restrict,
  required_value_id uuid not null references catalog.product_option_values(id) on delete restrict,
  dependency_kind text not null check (dependency_kind in ('REQUIRES', 'ALLOWS')),
  created_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  constraint product_option_dependencies_not_self check (selected_value_id <> required_value_id),
  constraint product_option_dependencies_unique unique (
    product_id, selected_value_id, required_value_id, dependency_kind
  )
);

create table catalog.product_dimension_rules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references catalog.products(id) on delete restrict,
  dimension_kind text not null check (dimension_kind in ('WIDTH', 'HEIGHT', 'LENGTH', 'DEPTH')),
  rule_kind text not null check (rule_kind in ('FIXED', 'RANGE', 'FREE')),
  unit text not null check (unit ~ '^[A-Za-z0-9]{1,12}$'),
  fixed_value numeric(12,3),
  minimum_value numeric(12,3),
  maximum_value numeric(12,3),
  created_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  updated_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint product_dimension_rules_unique unique (product_id, dimension_kind),
  constraint product_dimension_rules_shape check (
    (rule_kind = 'FIXED' and fixed_value is not null and fixed_value > 0
      and minimum_value is null and maximum_value is null)
    or (rule_kind = 'RANGE' and fixed_value is null and minimum_value is not null
      and maximum_value is not null and minimum_value > 0 and maximum_value >= minimum_value)
    or (rule_kind = 'FREE' and fixed_value is null
      and minimum_value is null and maximum_value is null)
  )
);

create function catalog.require_draft_product_for_configuration_delete()
returns trigger
language plpgsql
set search_path = pg_catalog, catalog
as $$
begin
  if not exists (
    select 1 from catalog.products p where p.id = old.product_id and p.lifecycle = 'DRAFT'
  ) then
    raise exception using errcode = '55000', message = 'only draft Product configuration can be replaced';
  end if;
  return old;
end
$$;

create function catalog.require_draft_product_for_option_value_delete()
returns trigger
language plpgsql
set search_path = pg_catalog, catalog
as $$
begin
  if not exists (
    select 1 from catalog.product_options o
    join catalog.products p on p.id = o.product_id
    where o.id = old.option_id and p.lifecycle = 'DRAFT'
  ) then
    raise exception using errcode = '55000', message = 'only draft Product option values can be replaced';
  end if;
  return old;
end
$$;

create trigger product_collections_draft_delete
before delete on catalog.product_collections
for each row execute function catalog.require_draft_product_for_configuration_delete();
create trigger product_materials_draft_delete
before delete on catalog.product_materials
for each row execute function catalog.require_draft_product_for_configuration_delete();
create trigger product_colors_draft_delete
before delete on catalog.product_colors
for each row execute function catalog.require_draft_product_for_configuration_delete();
create trigger product_options_draft_delete
before delete on catalog.product_options
for each row execute function catalog.require_draft_product_for_configuration_delete();
create trigger product_option_values_draft_delete
before delete on catalog.product_option_values
for each row execute function catalog.require_draft_product_for_option_value_delete();
create trigger product_option_exclusions_draft_delete
before delete on catalog.product_option_exclusions
for each row execute function catalog.require_draft_product_for_configuration_delete();
create trigger product_option_dependencies_draft_delete
before delete on catalog.product_option_dependencies
for each row execute function catalog.require_draft_product_for_configuration_delete();
create trigger product_dimension_rules_draft_delete
before delete on catalog.product_dimension_rules
for each row execute function catalog.require_draft_product_for_configuration_delete();

revoke all on function catalog.require_draft_product_for_configuration_delete() from public;
revoke all on function catalog.require_draft_product_for_option_value_delete() from public;

create function catalog.normalize_arabic_search(input text)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select trim(regexp_replace(
    regexp_replace(
      translate(lower(input), 'أإآٱىؤئ', 'اااايوي'),
      '[ـًٌٍَُِّْٰ]', '', 'g'
    ),
    '[^[:alnum:]ء-ي]+', ' ', 'g'
  ))
$$;

revoke all on function catalog.normalize_arabic_search(text) from public;

create table catalog.search_documents (
  product_id uuid not null references catalog.products(id) on delete cascade,
  locale text not null check (locale in ('ar', 'en')),
  source_translation_revision_id uuid not null
    references cms.translation_revisions(id) on delete restrict,
  name text not null,
  description text not null,
  normalized_text text not null,
  search_vector tsvector generated always as (to_tsvector('simple', normalized_text)) stored,
  published_at timestamptz not null,
  refreshed_at timestamptz not null default clock_timestamp(),
  primary key (product_id, locale)
);

create index products_public_category_idx
  on catalog.products(category_id, published_at desc, id)
  where lifecycle = 'PUBLISHED';
create index product_collections_collection_idx
  on catalog.product_collections(collection_id, sort_order, product_id);
create index search_documents_vector_idx
  on catalog.search_documents using gin(search_vector);
create index search_documents_trgm_idx
  on catalog.search_documents using gin(normalized_text extensions.gin_trgm_ops);

create table files.upload_intents (
  id uuid primary key default gen_random_uuid(),
  requesting_principal_id uuid not null references iam.principals(id) on delete restrict,
  idempotency_key text not null check (length(idempotency_key) between 8 and 255),
  purpose text not null check (purpose in (
    'REQUEST_REFERENCE', 'MESSAGE_ATTACHMENT', 'PAYMENT_PROOF',
    'HANDOFF_PROOF', 'CATALOG_MEDIA', 'CMS_MEDIA'
  )),
  target_type text not null check (target_type in (
    'PRODUCT', 'COLLECTION', 'CMS_CONTENT', 'CUSTOMER_PROJECT',
    'MESSAGE', 'PAYMENT_SUBMISSION', 'FULFILMENT'
  )),
  target_id uuid not null,
  classification text not null check (classification in (
    'PUBLIC_MEDIA_SOURCE', 'PRIVATE_CUSTOMER', 'SENSITIVE_PAYMENT', 'RESTRICTED_OPERATIONS'
  )),
  declared_display_filename text not null check (length(declared_display_filename) between 1 and 255),
  declared_media_type text not null check (length(declared_media_type) between 3 and 127),
  declared_size bigint not null check (declared_size > 0),
  expected_checksum text check (expected_checksum is null or expected_checksum ~ '^[0-9a-f]{64}$'),
  generated_object_key text not null unique check (
    length(generated_object_key) between 16 and 1024 and generated_object_key !~ '[\u0000-\u001f\u007f]'
  ),
  expected_zone text not null default 'QUARANTINE' check (expected_zone = 'QUARANTINE'),
  expires_at timestamptz not null,
  lifecycle text not null default 'PENDING'
    check (lifecycle in ('PENDING', 'FINALIZED', 'EXPIRED', 'CANCELLED')),
  finalized_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint upload_intents_idempotency_unique unique (requesting_principal_id, idempotency_key),
  constraint upload_intents_finalization_check check (
    (lifecycle = 'FINALIZED' and finalized_at is not null)
    or (lifecycle <> 'FINALIZED' and finalized_at is null)
  )
);

create table files.file_objects (
  id uuid primary key default gen_random_uuid(),
  upload_intent_id uuid not null unique references files.upload_intents(id) on delete restrict,
  uploader_principal_id uuid not null references iam.principals(id) on delete restrict,
  classification text not null check (classification in (
    'PUBLIC_MEDIA_SOURCE', 'PRIVATE_CUSTOMER', 'SENSITIVE_PAYMENT', 'RESTRICTED_OPERATIONS'
  )),
  purpose text not null check (purpose in (
    'REQUEST_REFERENCE', 'MESSAGE_ATTACHMENT', 'PAYMENT_PROOF',
    'HANDOFF_PROOF', 'CATALOG_MEDIA', 'CMS_MEDIA'
  )),
  logical_zone text not null check (logical_zone in (
    'QUARANTINE', 'PRIVATE_CUSTOMER', 'SENSITIVE_PAYMENT', 'RESTRICTED_OPERATIONS'
  )),
  storage_container text not null check (length(storage_container) between 3 and 255),
  object_key text not null check (length(object_key) between 16 and 1024),
  object_version text not null check (length(object_version) between 1 and 1024),
  byte_size bigint not null check (byte_size > 0),
  declared_media_type text not null check (length(declared_media_type) between 3 and 127),
  detected_media_type text not null check (length(detected_media_type) between 3 and 127),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  lifecycle text not null check (lifecycle in (
    'PENDING_UPLOAD', 'UPLOADED', 'SCAN_PENDING', 'CLEAN', 'QUARANTINED', 'REJECTED'
  )),
  scan_state text not null check (scan_state in ('PENDING', 'CLEAN', 'MALICIOUS', 'FAILED', 'UNKNOWN')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint file_objects_version_unique unique (logical_zone, storage_container, object_key, object_version),
  constraint file_objects_scan_lifecycle_check check (
    (scan_state = 'CLEAN' and lifecycle = 'CLEAN')
    or (scan_state = 'MALICIOUS' and lifecycle = 'QUARANTINED')
    or (scan_state in ('PENDING', 'FAILED', 'UNKNOWN')
      and lifecycle in ('PENDING_UPLOAD', 'UPLOADED', 'SCAN_PENDING', 'REJECTED'))
  )
);

create table files.scan_events (
  id uuid primary key default gen_random_uuid(),
  file_object_id uuid not null references files.file_objects(id) on delete restrict,
  provider text not null check (provider ~ '^[a-z][a-z0-9_]{1,31}$'),
  provider_event_id text not null check (length(provider_event_id) between 1 and 255),
  payload_digest text not null check (payload_digest ~ '^[0-9a-f]{64}$'),
  signature_verified boolean not null,
  outcome text not null check (outcome in ('CLEAN', 'MALICIOUS', 'FAILED', 'UNKNOWN', 'UNSUPPORTED')),
  safe_reason_code text,
  safe_metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(safe_metadata_json) = 'object'),
  provider_occurred_at timestamptz,
  received_at timestamptz not null default clock_timestamp(),
  correlation_id uuid not null,
  constraint scan_events_provider_event_unique unique (provider, provider_event_id)
);

create index scan_events_file_time_idx
  on files.scan_events(file_object_id, provider_occurred_at desc nulls last, received_at desc);

create table files.attachments (
  id uuid primary key default gen_random_uuid(),
  file_object_id uuid not null unique references files.file_objects(id) on delete restrict,
  uploader_principal_id uuid not null references iam.principals(id) on delete restrict,
  owner_customer_id uuid references iam.customers(id) on delete restrict,
  attachment_kind text not null check (attachment_kind in (
    'REQUEST_REFERENCE', 'MESSAGE_ATTACHMENT', 'PAYMENT_PROOF', 'HANDOFF_PROOF'
  )),
  availability text not null check (availability in (
    'PROCESSING', 'AVAILABLE', 'REJECTED', 'QUARANTINED'
  )),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1)
);

create table files.public_media_derivatives (
  id uuid primary key default gen_random_uuid(),
  source_file_object_id uuid not null references files.file_objects(id) on delete restrict,
  variant_kind text not null check (variant_kind in ('THUMBNAIL', 'GALLERY', 'HERO')),
  storage_container text not null check (length(storage_container) between 3 and 255),
  object_key text not null check (length(object_key) between 16 and 1024),
  object_version text not null check (length(object_version) between 1 and 1024),
  delivery_path text not null unique check (delivery_path ~ '^/media/[a-zA-Z0-9/_-]+\.[a-z0-9]+$'),
  media_type text not null check (media_type in ('image/avif', 'image/webp', 'image/jpeg', 'image/png')),
  byte_size bigint not null check (byte_size > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  lifecycle text not null default 'READY' check (lifecycle in ('READY', 'PUBLISHED', 'RETIRED')),
  created_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  published_by_principal_id uuid references iam.principals(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint public_media_derivatives_object_unique unique (
    storage_container, object_key, object_version
  ),
  constraint public_media_derivatives_budget_check check (
    (variant_kind = 'THUMBNAIL' and byte_size <= 81920)
    or (variant_kind = 'GALLERY' and byte_size <= 307200)
    or (variant_kind = 'HERO' and byte_size <= 409600)
  ),
  constraint public_media_derivatives_publication_check check (
    (lifecycle = 'PUBLISHED' and published_by_principal_id is not null and published_at is not null)
    or (lifecycle <> 'PUBLISHED' and published_by_principal_id is null and published_at is null)
  )
);

create table files.catalog_media (
  id uuid primary key default gen_random_uuid(),
  derivative_id uuid not null references files.public_media_derivatives(id) on delete restrict,
  product_id uuid references catalog.products(id) on delete restrict,
  collection_id uuid references catalog.collections(id) on delete restrict,
  alt_text_ar text not null check (length(trim(alt_text_ar)) between 1 and 300),
  alt_text_en text check (alt_text_en is null or length(trim(alt_text_en)) between 1 and 300),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_primary boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  constraint catalog_media_one_parent check (
    (product_id is not null)::integer + (collection_id is not null)::integer = 1
  ),
  constraint catalog_media_derivative_parent_unique unique (derivative_id, product_id, collection_id)
);

create table files.cms_media (
  id uuid primary key default gen_random_uuid(),
  derivative_id uuid not null references files.public_media_derivatives(id) on delete restrict,
  content_id uuid not null references cms.contents(id) on delete restrict,
  alt_text_ar text not null check (length(trim(alt_text_ar)) between 1 and 300),
  alt_text_en text check (alt_text_en is null or length(trim(alt_text_en)) between 1 and 300),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default clock_timestamp(),
  constraint cms_media_derivative_content_unique unique (derivative_id, content_id)
);

create table files.reconciliation_findings (
  id uuid primary key default gen_random_uuid(),
  finding_type text not null check (finding_type in (
    'MISSING_OBJECT', 'UNEXPECTED_OBJECT', 'VERSION_MISMATCH',
    'SIZE_MISMATCH', 'CHECKSUM_MISMATCH', 'ZONE_MISMATCH', 'EVENT_GAP'
  )),
  file_object_id uuid references files.file_objects(id) on delete restrict,
  expected_zone text,
  expected_container text,
  expected_key text,
  expected_version text,
  observed_schema_version integer not null check (observed_schema_version >= 1),
  observed_json jsonb not null check (jsonb_typeof(observed_json) = 'object'),
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  safe_reason_code text not null,
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint reconciliation_findings_time_check check (last_observed_at >= first_observed_at),
  constraint reconciliation_findings_resolution_check check (
    (status = 'OPEN' and resolved_at is null)
    or (status = 'RESOLVED' and resolved_at is not null)
  )
);

create unique index reconciliation_one_open_finding_per_file_type
  on files.reconciliation_findings(file_object_id, finding_type)
  where status = 'OPEN' and file_object_id is not null;

create function files.protect_scan_event_history()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '55000', message = 'file scan events are append-only';
end
$$;

create trigger scan_events_append_only
before update or delete on files.scan_events
for each row execute function files.protect_scan_event_history();

create function files.apply_scan_result(
  p_storage_container text,
  p_object_key text,
  p_object_version text,
  p_provider text,
  p_provider_event_id text,
  p_payload_digest text,
  p_outcome text,
  p_provider_occurred_at timestamptz,
  p_safe_reason_code text,
  p_safe_metadata_json jsonb,
  p_correlation_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, iam, files
as $$
declare
  v_file files.file_objects%rowtype;
  v_existing files.scan_events%rowtype;
begin
  if iam.current_actor_kind() <> 'provider_webhook'
    or iam.current_auth_assurance() <> 'provider_signature' then
    raise exception using errcode = '42501', message = 'verified provider context required';
  end if;
  if p_provider <> 'guardduty'
    or p_outcome not in ('CLEAN', 'MALICIOUS', 'FAILED', 'UNKNOWN', 'UNSUPPORTED')
    or p_payload_digest !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_safe_metadata_json) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid scan result';
  end if;

  select * into v_file
  from files.file_objects
  where storage_container = p_storage_container
    and object_key = p_object_key
    and object_version = p_object_version
  for update;
  if not found then
    return 'NOT_FOUND';
  end if;

  select * into v_existing
  from files.scan_events
  where provider = p_provider and provider_event_id = p_provider_event_id;
  if found then
    if v_existing.payload_digest <> p_payload_digest then
      raise exception using errcode = '23505', message = 'provider event digest conflict';
    end if;
    return 'DUPLICATE';
  end if;

  insert into files.scan_events (
    file_object_id, provider, provider_event_id, payload_digest,
    signature_verified, outcome, safe_reason_code, safe_metadata_json,
    provider_occurred_at, correlation_id
  ) values (
    v_file.id, p_provider, p_provider_event_id, p_payload_digest,
    true, p_outcome, p_safe_reason_code, p_safe_metadata_json,
    p_provider_occurred_at, p_correlation_id
  );

  if p_outcome = 'MALICIOUS' then
    update files.file_objects
    set lifecycle = 'QUARANTINED', scan_state = 'MALICIOUS',
        updated_at = clock_timestamp(), record_version = record_version + 1
    where id = v_file.id;
    return 'QUARANTINED';
  end if;

  if v_file.lifecycle = 'QUARANTINED' or v_file.scan_state = 'MALICIOUS' then
    return 'IGNORED_TERMINAL';
  end if;

  if p_outcome = 'CLEAN' and v_file.lifecycle in ('UPLOADED', 'SCAN_PENDING') then
    update files.file_objects
    set lifecycle = 'CLEAN', scan_state = 'CLEAN',
        updated_at = clock_timestamp(), record_version = record_version + 1
    where id = v_file.id;
    return 'CLEAN';
  end if;

  if p_outcome in ('FAILED', 'UNKNOWN', 'UNSUPPORTED')
    and v_file.lifecycle in ('UPLOADED', 'SCAN_PENDING') then
    update files.file_objects
    set lifecycle = 'SCAN_PENDING',
        scan_state = case when p_outcome = 'FAILED' then 'FAILED' else 'UNKNOWN' end,
        updated_at = clock_timestamp(), record_version = record_version + 1
    where id = v_file.id;

    insert into files.reconciliation_findings (
      finding_type, file_object_id, expected_zone, expected_container,
      expected_key, expected_version, observed_schema_version, observed_json,
      safe_reason_code, first_observed_at, last_observed_at
    ) values (
      'EVENT_GAP', v_file.id, v_file.logical_zone, v_file.storage_container,
      v_file.object_key, v_file.object_version, 1,
      jsonb_build_object('provider', p_provider, 'scan_outcome', p_outcome),
      coalesce(p_safe_reason_code, 'SCAN_RESULT_NOT_CLEAN'),
      clock_timestamp(), clock_timestamp()
    )
    on conflict (file_object_id, finding_type) where status = 'OPEN' and file_object_id is not null
    do update set
      observed_json = excluded.observed_json,
      safe_reason_code = excluded.safe_reason_code,
      last_observed_at = excluded.last_observed_at,
      updated_at = clock_timestamp(),
      record_version = files.reconciliation_findings.record_version + 1;
  end if;
  return 'PENDING';
end
$$;

revoke all on function files.protect_scan_event_history() from public;
revoke all on function files.apply_scan_result(
  text, text, text, text, text, text, text, timestamptz, text, jsonb, uuid
) from public;

create function files.enforce_public_media_promotion()
returns trigger
language plpgsql
set search_path = pg_catalog, files
as $$
declare
  v_source files.file_objects%rowtype;
begin
  if new.lifecycle = 'PUBLISHED'
    and (tg_op = 'INSERT' or old.lifecycle <> 'PUBLISHED') then
    select * into v_source
    from files.file_objects
    where id = new.source_file_object_id
    for key share;
    if not found
      or v_source.lifecycle <> 'CLEAN'
      or v_source.scan_state <> 'CLEAN'
      or v_source.classification <> 'PUBLIC_MEDIA_SOURCE'
      or v_source.purpose not in ('CATALOG_MEDIA', 'CMS_MEDIA') then
      raise exception using errcode = '23514', message = 'only clean approved public media sources can be published';
    end if;
  end if;
  return new;
end
$$;

create trigger public_media_promotion_guard
before insert or update on files.public_media_derivatives
for each row execute function files.enforce_public_media_promotion();

revoke all on function files.enforce_public_media_promotion() from public;

-- Every P2 relation uses RLS, including public projections, so publication is explicit.
alter table cms.localized_resources enable row level security;
alter table cms.localized_resources force row level security;
alter table cms.translation_revisions enable row level security;
alter table cms.translation_revisions force row level security;
alter table cms.contents enable row level security;
alter table cms.contents force row level security;
alter table cms.content_versions enable row level security;
alter table cms.content_versions force row level security;

alter table catalog.categories enable row level security;
alter table catalog.categories force row level security;
alter table catalog.collections enable row level security;
alter table catalog.collections force row level security;
alter table catalog.products enable row level security;
alter table catalog.products force row level security;
alter table catalog.product_collections enable row level security;
alter table catalog.product_collections force row level security;
alter table catalog.materials enable row level security;
alter table catalog.materials force row level security;
alter table catalog.colors enable row level security;
alter table catalog.colors force row level security;
alter table catalog.product_materials enable row level security;
alter table catalog.product_materials force row level security;
alter table catalog.product_colors enable row level security;
alter table catalog.product_colors force row level security;
alter table catalog.product_options enable row level security;
alter table catalog.product_options force row level security;
alter table catalog.product_option_values enable row level security;
alter table catalog.product_option_values force row level security;
alter table catalog.product_option_exclusions enable row level security;
alter table catalog.product_option_exclusions force row level security;
alter table catalog.product_option_dependencies enable row level security;
alter table catalog.product_option_dependencies force row level security;
alter table catalog.product_dimension_rules enable row level security;
alter table catalog.product_dimension_rules force row level security;
alter table catalog.search_documents enable row level security;
alter table catalog.search_documents force row level security;

alter table files.upload_intents enable row level security;
alter table files.upload_intents force row level security;
alter table files.file_objects enable row level security;
alter table files.file_objects force row level security;
alter table files.scan_events enable row level security;
alter table files.scan_events force row level security;
alter table files.attachments enable row level security;
alter table files.attachments force row level security;
alter table files.public_media_derivatives enable row level security;
alter table files.public_media_derivatives force row level security;
alter table files.catalog_media enable row level security;
alter table files.catalog_media force row level security;
alter table files.cms_media enable row level security;
alter table files.cms_media force row level security;
alter table files.reconciliation_findings enable row level security;
alter table files.reconciliation_findings force row level security;

create policy localized_resources_public_read on cms.localized_resources
  for select to atelier_runtime
  using (
    iam.current_actor_kind() in ('visitor', 'customer', 'manager', 'system_job', 'operator')
    and (
      current_ar_revision_id is not null
      or current_en_revision_id is not null
      or iam.current_actor_kind() in ('manager', 'operator')
    )
  );
create policy localized_resources_manager_write on cms.localized_resources
  for all to atelier_runtime
  using (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa')
  with check (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa');

create policy translation_revisions_public_read on cms.translation_revisions
  for select to atelier_runtime
  using (
    lifecycle = 'PUBLISHED' and not stale_source and exists (
      select 1 from cms.localized_resources r
      where r.id = translation_revisions.resource_id
        and (r.current_ar_revision_id = translation_revisions.id
          or r.current_en_revision_id = translation_revisions.id)
    )
    or iam.current_actor_kind() in ('manager', 'operator')
  );
create policy translation_revisions_manager_write on cms.translation_revisions
  for all to atelier_runtime
  using (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa')
  with check (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa');

create policy contents_public_read on cms.contents
  for select to atelier_runtime
  using (visibility = 'PUBLISHED' or iam.current_actor_kind() in ('manager', 'operator'));
create policy contents_manager_write on cms.contents
  for all to atelier_runtime
  using (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa')
  with check (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa');

create policy content_versions_public_read on cms.content_versions
  for select to atelier_runtime
  using (
    lifecycle = 'PUBLISHED' and exists (
      select 1 from cms.contents c
      where c.id = content_versions.content_id and c.visibility = 'PUBLISHED'
        and c.current_published_version_id = content_versions.id
    )
    or iam.current_actor_kind() in ('manager', 'operator')
  );
create policy content_versions_manager_write on cms.content_versions
  for all to atelier_runtime
  using (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa')
  with check (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa');

create policy categories_public_read on catalog.categories
  for select to atelier_runtime
  using (lifecycle = 'PUBLISHED' or iam.current_actor_kind() in ('manager', 'operator'));
create policy collections_public_read on catalog.collections
  for select to atelier_runtime
  using (lifecycle = 'PUBLISHED' or iam.current_actor_kind() in ('manager', 'operator'));
create policy products_public_read on catalog.products
  for select to atelier_runtime
  using (lifecycle = 'PUBLISHED' or iam.current_actor_kind() in ('manager', 'operator'));
create policy materials_public_read on catalog.materials
  for select to atelier_runtime
  using (lifecycle = 'PUBLISHED' or iam.current_actor_kind() in ('manager', 'operator'));
create policy colors_public_read on catalog.colors
  for select to atelier_runtime
  using (lifecycle = 'PUBLISHED' or iam.current_actor_kind() in ('manager', 'operator'));
create policy product_options_public_read on catalog.product_options
  for select to atelier_runtime
  using (
    lifecycle = 'PUBLISHED' and exists (
      select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED'
    ) or iam.current_actor_kind() in ('manager', 'operator')
  );
create policy product_option_values_public_read on catalog.product_option_values
  for select to atelier_runtime
  using (
    lifecycle = 'PUBLISHED' and available and exists (
      select 1 from catalog.product_options o
      join catalog.products p on p.id = o.product_id
      where o.id = option_id and o.lifecycle = 'PUBLISHED' and p.lifecycle = 'PUBLISHED'
    ) or iam.current_actor_kind() in ('manager', 'operator')
  );

create policy catalog_manager_write_categories on catalog.categories
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );
create policy catalog_manager_write_collections on catalog.collections
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );
create policy catalog_manager_write_products on catalog.products
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );
create policy catalog_manager_write_materials on catalog.materials
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );
create policy catalog_manager_write_colors on catalog.colors
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );
create policy catalog_manager_write_options on catalog.product_options
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );
create policy catalog_manager_write_option_values on catalog.product_option_values
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );

create policy product_collections_public_read on catalog.product_collections
  for select to atelier_runtime using (
    exists (select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED')
    and exists (select 1 from catalog.collections c where c.id = collection_id and c.lifecycle = 'PUBLISHED')
    or iam.current_actor_kind() in ('manager', 'operator')
  );
create policy product_materials_public_read on catalog.product_materials
  for select to atelier_runtime using (
    available
    and exists (select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED')
    and exists (select 1 from catalog.materials m where m.id = material_id and m.lifecycle = 'PUBLISHED')
    or iam.current_actor_kind() in ('manager', 'operator')
  );
create policy product_colors_public_read on catalog.product_colors
  for select to atelier_runtime using (
    available
    and exists (select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED')
    and exists (select 1 from catalog.colors c where c.id = color_id and c.lifecycle = 'PUBLISHED')
    or iam.current_actor_kind() in ('manager', 'operator')
  );
create policy exclusions_public_read on catalog.product_option_exclusions
  for select to atelier_runtime using (
    exists (select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED')
    or iam.current_actor_kind() in ('manager', 'operator')
  );
create policy dependencies_public_read on catalog.product_option_dependencies
  for select to atelier_runtime using (
    exists (select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED')
    or iam.current_actor_kind() in ('manager', 'operator')
  );
create policy dimensions_public_read on catalog.product_dimension_rules
  for select to atelier_runtime using (
    exists (select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED')
    or iam.current_actor_kind() in ('manager', 'operator')
  );

create policy catalog_manager_write_product_collections on catalog.product_collections
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );
create policy catalog_manager_write_product_materials on catalog.product_materials
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );
create policy catalog_manager_write_product_colors on catalog.product_colors
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );
create policy catalog_manager_write_exclusions on catalog.product_option_exclusions
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );
create policy catalog_manager_write_dependencies on catalog.product_option_dependencies
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );
create policy catalog_manager_write_dimensions on catalog.product_dimension_rules
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );

create policy search_documents_public_read on catalog.search_documents
  for select to atelier_runtime using (
    exists (select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED')
  );
create policy search_documents_manager_read on catalog.search_documents
  for select to atelier_runtime using (iam.current_actor_kind() in ('manager', 'operator'));
create policy search_documents_job_write on catalog.search_documents
  for all to atelier_job
  using (iam.current_actor_kind() = 'system_job')
  with check (
    iam.current_actor_kind() = 'system_job'
    and exists (select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED')
  );

create policy localized_resources_job_read on cms.localized_resources
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job' and current_ar_revision_id is not null
  );
create policy translation_revisions_job_read on cms.translation_revisions
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job' and lifecycle = 'PUBLISHED' and not stale_source
    and exists (
      select 1 from cms.localized_resources r
      where r.id = translation_revisions.resource_id
        and (r.current_ar_revision_id = translation_revisions.id
          or r.current_en_revision_id = translation_revisions.id)
    )
  );
create policy contents_job_read on cms.contents
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job' and visibility = 'PUBLISHED'
  );
create policy content_versions_job_read on cms.content_versions
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job' and lifecycle = 'PUBLISHED'
    and exists (
      select 1 from cms.contents c
      where c.id = content_versions.content_id and c.visibility = 'PUBLISHED'
        and c.current_published_version_id = content_versions.id
    )
  );
create policy categories_job_read on catalog.categories
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job' and lifecycle = 'PUBLISHED'
  );
create policy collections_job_read on catalog.collections
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job' and lifecycle = 'PUBLISHED'
  );
create policy products_job_read on catalog.products
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job'
  );
create policy materials_job_read on catalog.materials
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job' and lifecycle = 'PUBLISHED'
  );
create policy colors_job_read on catalog.colors
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job' and lifecycle = 'PUBLISHED'
  );
create policy product_options_job_read on catalog.product_options
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job' and lifecycle = 'PUBLISHED'
    and exists (select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED')
  );
create policy product_option_values_job_read on catalog.product_option_values
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job' and lifecycle = 'PUBLISHED' and available
    and exists (
      select 1 from catalog.product_options o
      join catalog.products p on p.id = o.product_id
      where o.id = option_id and o.lifecycle = 'PUBLISHED' and p.lifecycle = 'PUBLISHED'
    )
  );
create policy product_collections_job_read on catalog.product_collections
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job'
    and exists (select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED')
    and exists (select 1 from catalog.collections c where c.id = collection_id and c.lifecycle = 'PUBLISHED')
  );
create policy product_materials_job_read on catalog.product_materials
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job' and available
    and exists (select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED')
    and exists (select 1 from catalog.materials m where m.id = material_id and m.lifecycle = 'PUBLISHED')
  );
create policy product_colors_job_read on catalog.product_colors
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job' and available
    and exists (select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED')
    and exists (select 1 from catalog.colors c where c.id = color_id and c.lifecycle = 'PUBLISHED')
  );
create policy exclusions_job_read on catalog.product_option_exclusions
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job'
    and exists (select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED')
  );
create policy dependencies_job_read on catalog.product_option_dependencies
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job'
    and exists (select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED')
  );
create policy dimensions_job_read on catalog.product_dimension_rules
  for select to atelier_job using (
    iam.current_actor_kind() = 'system_job'
    and exists (select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED')
  );

create policy upload_intents_manager_access on files.upload_intents
  for all to atelier_runtime
  using (
    iam.current_actor_kind() = 'manager'
    and iam.current_auth_assurance() = 'manager_mfa'
    and requesting_principal_id = iam.current_principal_id()
  ) with check (
    iam.current_actor_kind() = 'manager'
    and iam.current_auth_assurance() = 'manager_mfa'
    and requesting_principal_id = iam.current_principal_id()
    and purpose in ('CATALOG_MEDIA', 'CMS_MEDIA')
    and classification = 'PUBLIC_MEDIA_SOURCE'
    and target_type in ('PRODUCT', 'COLLECTION', 'CMS_CONTENT')
  );

create policy file_objects_manager_access on files.file_objects
  for all to atelier_runtime
  using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
    and uploader_principal_id = iam.current_principal_id()
    and purpose in ('CATALOG_MEDIA', 'CMS_MEDIA')
    and classification = 'PUBLIC_MEDIA_SOURCE'
    and logical_zone = 'QUARANTINE'
  );
create policy file_objects_job_read on files.file_objects
  for select to atelier_job using (iam.current_actor_kind() = 'system_job');

create policy scan_events_manager_read on files.scan_events
  for select to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );
create policy scan_events_job_read on files.scan_events
  for select to atelier_job using (iam.current_actor_kind() = 'system_job');

create policy attachments_manager_access on files.attachments
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );

create policy derivatives_public_read on files.public_media_derivatives
  for select to atelier_runtime using (lifecycle = 'PUBLISHED');
create policy derivatives_job_read on files.public_media_derivatives
  for select to atelier_job using (iam.current_actor_kind() = 'system_job');
create policy derivatives_manager_write on files.public_media_derivatives
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );

create policy catalog_media_public_read on files.catalog_media
  for select to atelier_runtime using (
    exists (
      select 1 from files.public_media_derivatives d
      where d.id = derivative_id and d.lifecycle = 'PUBLISHED'
    ) and (
      (product_id is not null and exists (
        select 1 from catalog.products p where p.id = product_id and p.lifecycle = 'PUBLISHED'
      ))
      or (collection_id is not null and exists (
        select 1 from catalog.collections c where c.id = collection_id and c.lifecycle = 'PUBLISHED'
      ))
    )
  );
create policy catalog_media_manager_write on files.catalog_media
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );

create policy cms_media_public_read on files.cms_media
  for select to atelier_runtime using (
    exists (
      select 1 from files.public_media_derivatives d
      where d.id = derivative_id and d.lifecycle = 'PUBLISHED'
    ) and exists (
      select 1 from cms.contents c where c.id = content_id and c.visibility = 'PUBLISHED'
    )
  );
create policy cms_media_manager_write on files.cms_media
  for all to atelier_runtime using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );

create policy reconciliation_job_access on files.reconciliation_findings
  for all to atelier_job using (iam.current_actor_kind() = 'system_job')
  with check (iam.current_actor_kind() = 'system_job');
create policy reconciliation_operator_access on files.reconciliation_findings
  for all to atelier_runtime using (iam.current_actor_kind() = 'operator')
  with check (iam.current_actor_kind() = 'operator');
create policy reconciliation_operations_read on files.reconciliation_findings
  for select to atelier_operations_readonly using (true);

grant usage on schema extensions, cms, catalog, files to atelier_runtime;
grant usage on schema extensions, cms, catalog, files to atelier_job;
grant usage on schema files to atelier_operations_readonly;

grant execute on function catalog.normalize_arabic_search(text)
  to atelier_runtime, atelier_job;
grant execute on function files.apply_scan_result(
  text, text, text, text, text, text, text, timestamptz, text, jsonb, uuid
) to atelier_runtime;

grant select, insert, update on cms.localized_resources, cms.translation_revisions,
  cms.contents, cms.content_versions to atelier_runtime;
grant select on cms.localized_resources, cms.translation_revisions,
  cms.contents, cms.content_versions to atelier_job;
grant select, insert, update on catalog.categories, catalog.collections, catalog.products,
  catalog.product_collections, catalog.materials, catalog.colors,
  catalog.product_materials, catalog.product_colors, catalog.product_options,
  catalog.product_option_values, catalog.product_option_exclusions,
  catalog.product_option_dependencies, catalog.product_dimension_rules to atelier_runtime;
grant delete on catalog.product_collections, catalog.product_materials, catalog.product_colors,
  catalog.product_options, catalog.product_option_values, catalog.product_option_exclusions,
  catalog.product_option_dependencies, catalog.product_dimension_rules to atelier_runtime;
grant select on catalog.search_documents to atelier_runtime;
grant select on catalog.categories, catalog.collections,
  catalog.product_collections, catalog.materials, catalog.colors,
  catalog.product_materials, catalog.product_colors, catalog.product_options,
  catalog.product_option_values, catalog.product_option_exclusions,
  catalog.product_option_dependencies, catalog.product_dimension_rules to atelier_job;
grant select (id, localized_resource_id, lifecycle, record_version) on catalog.products
  to atelier_job;
grant select, insert, update, delete on catalog.search_documents to atelier_job;

grant select, insert, update on files.upload_intents, files.file_objects,
  files.attachments, files.public_media_derivatives, files.catalog_media, files.cms_media
  to atelier_runtime;
grant select on files.scan_events to atelier_runtime;
grant select on files.file_objects, files.scan_events, files.public_media_derivatives to atelier_job;
grant select, insert, update on files.reconciliation_findings to atelier_job;
grant select, insert, update on files.reconciliation_findings to atelier_runtime;
grant select on files.reconciliation_findings to atelier_operations_readonly;

revoke delete, truncate on cms.translation_revisions from atelier_runtime;
revoke delete, truncate on cms.content_versions from atelier_runtime;
revoke insert, update, delete, truncate on files.scan_events
  from atelier_runtime, atelier_job, atelier_operations_readonly;
revoke delete, truncate on files.reconciliation_findings
  from atelier_runtime, atelier_job, atelier_operations_readonly;
revoke create on schema cms, catalog, files
  from atelier_runtime, atelier_job, atelier_operations_readonly, atelier_identity_resolver;

comment on schema cms is 'CMS and Localization module-owned schema';
comment on schema catalog is 'Catalog and Search module-owned schema';
comment on schema files is 'Files and Media module-owned schema';
comment on table catalog.search_documents is 'Rebuildable published-only public search projection';
comment on table files.scan_events is 'Append-only verified file scan observations';
comment on table files.public_media_derivatives is 'Optimized public renditions; never original uploads';
