import { createHash } from 'node:crypto';
import process from 'node:process';
import { Client } from 'pg';

const environment = process.env.APP_ENV ?? 'development';
if (environment === 'production' || environment === 'staging') {
  throw new Error('Demo seed is disabled outside development and test.');
}
const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error('DATABASE_URL is required.');

const ids = Object.freeze({
  category: '75000000-0000-4000-8000-000000000001',
  categoryResource: '75100000-0000-4000-8000-000000000001',
  customer: '71000000-0000-4000-8000-000000000001',
  customerPrincipal: '72000000-0000-4000-8000-000000000001',
  manager: '73000000-0000-4000-8000-000000000001',
  managerPrincipal: '74000000-0000-4000-8000-000000000001',
});

const products = [
  [
    '11111111-1111-4111-8111-111111111111',
    'SOFA',
    'كنبة سكينة',
    'كنبة هادئة بخطوط نظيفة، تُنفذ بالمقاس والخامة واللون المناسب لمساحتك.',
    'يحدد وقت التنفيذ بعد مراجعة المقاس والخامة.',
  ],
  [
    '22222222-2222-4222-8222-222222222222',
    'BED',
    'سرير هدوء',
    'سرير بطابع دافئ ولوح خلفي قابل للتخصيص ليتناسب مع تصميم الغرفة.',
    'التنفيذ حسب المقاسات النهائية المعتمدة.',
  ],
  [
    '33333333-3333-4333-8333-333333333333',
    'DINING_TABLE',
    'طاولة لَمّة',
    'طاولة تجمع بين بساطة الشكل ومتانة الاستخدام اليومي، بعدد مقاعد تختاره.',
    'تُراجع سماكة السطح ونوع القاعدة قبل التسعير.',
  ],
  [
    '44444444-4444-4444-8444-444444444444',
    'WARDROBE',
    'دولاب ترتيب',
    'دولاب عملي بتقسيمات داخلية تُبنى حول احتياجك ومساحة الجدار المتاحة.',
    'تُعتمد التقسيمات والأبواب بعد معاينة المتطلبات.',
  ],
  [
    '55555555-5555-4555-8555-555555555555',
    'TV_UNIT',
    'وحدة مشهد',
    'وحدة تلفاز خفيفة بصريًا مع تخزين مخفي ومساحات منظمة للأجهزة والأسلاك.',
    'تُحدد الفتحات والمقاسات وفق الأجهزة وموقع التوصيلات.',
  ],
  [
    '66666666-6666-4666-8666-666666666666',
    'SHELF',
    'مكتبة أفق',
    'مكتبة جدارية مرنة تجمع العرض والتخزين وتُصمم لتستفيد من كامل المساحة.',
    'التكوين النهائي يعتمد على أبعاد الجدار والاستخدام المطلوب.',
  ],
];

const client = new Client({ connectionString });
await client.connect();
try {
  await client.query('begin');
  await client.query(
    `insert into iam.principals (id, actor_type)
     values ($1, 'CUSTOMER'), ($2, 'MANAGER')
     on conflict (id) do nothing`,
    [ids.customerPrincipal, ids.managerPrincipal],
  );
  await client.query(
    `insert into iam.customers
       (id, principal_id, verified_email_snapshot, contact_email, preferred_locale)
     values ($1, $2, 'demo.customer@example.invalid', 'demo.customer@example.invalid', 'ar')
     on conflict (id) do update set contact_email = excluded.contact_email`,
    [ids.customer, ids.customerPrincipal],
  );
  await client.query(
    `insert into iam.managers
       (id, principal_id, bootstrap_reason_code, changed_by_principal_id)
     values ($1, $2, 'LOCAL_DEMO', $2)
     on conflict (id) do nothing`,
    [ids.manager, ids.managerPrincipal],
  );

  await client.query(
    `insert into cms.localized_resources
       (id, resource_type, created_by_principal_id)
     values ($1, 'CATEGORY', $2)
     on conflict (id) do nothing`,
    [ids.categoryResource, ids.managerPrincipal],
  );
  await client.query(
    `insert into catalog.categories
       (id, localized_resource_id, lifecycle, created_by_principal_id, updated_by_principal_id)
     values ($1, $2, 'PUBLISHED', $3, $3)
     on conflict (id) do nothing`,
    [ids.category, ids.categoryResource, ids.managerPrincipal],
  );

  for (let index = 0; index < products.length; index += 1) {
    const [productId, furnitureType, name, description, productionInformation] = products[index];
    const resourceId = `76${String(index + 1).padStart(2, '0')}0000-0000-4000-8000-000000000001`;
    const translationId = `77${String(index + 1).padStart(2, '0')}0000-0000-4000-8000-000000000001`;
    await client.query(
      `insert into cms.localized_resources
         (id, resource_type, created_by_principal_id)
       values ($1, 'PRODUCT', $2)
       on conflict (id) do nothing`,
      [resourceId, ids.managerPrincipal],
    );
    await client.query(
      `insert into cms.translation_revisions
         (id, resource_id, locale, revision_number, lifecycle,
          content_schema_version, content_json, stale_source, content_digest,
          authored_by_principal_id, reviewed_by_principal_id,
          approved_by_principal_id, published_by_principal_id,
          reviewed_at, approved_at, published_at)
       values ($1, $2, 'ar', 1, 'PUBLISHED', 1,
               jsonb_build_object('name', $3::text, 'description', $4::text),
               false, $5,
               $6, $6, $6, $6, clock_timestamp(), clock_timestamp(), clock_timestamp())
       on conflict (id) do nothing`,
      [
        translationId,
        resourceId,
        name,
        description,
        createHash('sha256').update(`${name}:${description}`).digest('hex'),
        ids.managerPrincipal,
      ],
    );
    await client.query(
      `update cms.localized_resources set current_ar_revision_id = $2 where id = $1`,
      [resourceId, translationId],
    );
    await client.query(
      `insert into catalog.products
         (id, localized_resource_id, category_id, furniture_type, lifecycle,
          starting_amount_minor, currency_code, production_information,
          created_by_principal_id, updated_by_principal_id, published_at)
       values ($1, $2, $3, $4, 'PUBLISHED', 0, 'SAR', $5, $6, $6, clock_timestamp())
       on conflict (id) do nothing`,
      [
        productId,
        resourceId,
        ids.category,
        furnitureType,
        productionInformation,
        ids.managerPrincipal,
      ],
    );
  }
  await client.query('commit');
  process.stdout.write('Local demo identities and six Arabic products are ready.\n');
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
