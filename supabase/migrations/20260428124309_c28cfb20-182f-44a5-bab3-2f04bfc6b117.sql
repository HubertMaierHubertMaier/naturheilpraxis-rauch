UPDATE public.admin_knowledge_base
SET tags = (
  SELECT ARRAY(
    SELECT DISTINCT tag
    FROM unnest(tags || ARRAY[
      'Bifidobacterium bifidum',
      'Bifidobacterium infantis',
      'Bifidobacterium lactis',
      'Bifidobacterium longum',
      'Lactobacillus acidophilus',
      'Lactobacillus casei',
      'Lactobacillus lactis',
      'Lactobacillus paracasei',
      'Lactobacillus plantarum',
      'Lactobacillus reuteri',
      'Lactobacillus rhamnosus'
    ]) AS tag
    WHERE tag IS NOT NULL AND btrim(tag) <> ''
    ORDER BY tag
  )
),
updated_at = now()
WHERE title = 'Biotik Balance Kapseln'
  AND category = 'Naturheilpraxis Peter Rauch > Vitaplace > Nahrungsergänzungsmittel';

UPDATE public.admin_knowledge_base
SET tags = (
  SELECT ARRAY(
    SELECT DISTINCT tag
    FROM unnest(tags || ARRAY[
      'Bifidobacterium infantis',
      'Bifidobacterium infantis CNCM I-5090',
      'Bifidobacterium longum',
      'Bifidobacterium longum CNCM I-5097',
      'Lactobacillus rhamnosus',
      'Lactobacillus rhamnosus CIRM-BIA113',
      'Lactobacillus gasseri',
      'Lactobacillus gasseri CNCM I-5076',
      'Lactobacillus salivarius',
      'Lactobacillus salivarius CNCM I-4912',
      'Lactobacillus reuteri',
      'Lactobacillus reuteri CIRM-BIA 929'
    ]) AS tag
    WHERE tag IS NOT NULL AND btrim(tag) <> ''
    ORDER BY tag
  )
),
updated_at = now()
WHERE title = 'Biotik Sensitiv Pulver'
  AND category = 'Naturheilpraxis Peter Rauch > Vitaplace > Nahrungsergänzungsmittel';