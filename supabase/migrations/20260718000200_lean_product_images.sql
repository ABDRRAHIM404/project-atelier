create table catalog.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references catalog.products(id) on delete cascade,
  storage_path text not null unique,
  public_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_by_principal_id uuid,
  created_at timestamptz not null default clock_timestamp()
);

create unique index product_images_primary_unique
  on catalog.product_images(product_id)
  where is_primary;

alter table catalog.product_images enable row level security;
alter table catalog.product_images force row level security;

create policy product_images_public_read on catalog.product_images
  for select to atelier_runtime
  using (
    exists (
      select 1 from catalog.products p
      where p.id = product_id and p.lifecycle = 'PUBLISHED'
    )
  );

create policy product_images_manager_write on catalog.product_images
  for all to atelier_runtime
  using (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  ) with check (
    iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'
  );

grant select, insert, update, delete on catalog.product_images to atelier_runtime;
