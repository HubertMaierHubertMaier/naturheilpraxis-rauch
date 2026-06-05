# 07 — Phase 1 Status: Vitest Option B

Stand: 2026-06-04T21:11:31+02:00
Branch: stabilization/phase-1-vitest-baseline
Commit vor Änderung: 324d2ce60e6a4145783784bb5ce403c990a6cbaa

## Änderung

`vitest.config.ts` wurde von `@vitejs/plugin-react-swc` auf das bereits vorhandene `@vitejs/plugin-react` umgestellt.

## Git-Diff
```diff
diff --git a/vitest.config.ts b/vitest.config.ts
index fefe05a..979d752 100644
--- a/vitest.config.ts
+++ b/vitest.config.ts
@@ -1,5 +1,5 @@
 import { defineConfig } from "vitest/config";
-import react from "@vitejs/plugin-react-swc";
+import react from "@vitejs/plugin-react";
 import path from "path";
 
 export default defineConfig({
```

## Kommando: npm test
```
$ npm test

> vite_react_shadcn_ts@0.0.0 test
> vitest run


 RUN  v3.2.6 /home/klaus999/projects/naturheilpraxis-rauch

 ✓ src/test/example.test.ts (1 test) 1ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  21:11:31
   Duration  488ms (transform 27ms, setup 41ms, collect 5ms, tests 1ms, environment 206ms, prepare 154ms)

EXIT_CODE=0
```

## Kommando: npm run build
```
$ npm run build

> vite_react_shadcn_ts@0.0.0 build
> vite build

vite v5.4.21 building for production...
transforming...
[vite:css] @import must precede all other statements (besides @charset or empty @layer)
3  |  @tailwind utilities;
4  |  
5  |  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600&display=swap');
   |  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
6  |  
7  |  @layer base {
✓ 3326 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                           2.37 kB │ gzip:   0.77 kB
dist/assets/frequenztherapie-hero-ElXsSBYZ.jpg           67.77 kB
dist/assets/frequenztherapie-behandlung-Bt4U96ry.jpg     73.76 kB
dist/assets/frequenztherapie-zellen-C0dgyZb-.jpg        122.03 kB
dist/assets/hero-nature-Kddgtusi.jpg                    184.87 kB
dist/assets/index-BMIuUrtn.css                          109.53 kB │ gzip:  18.45 kB
dist/assets/purify.es-V6uLfjnH.js                        26.92 kB │ gzip:  10.17 kB
dist/assets/index.es--CEFPIul.js                        150.69 kB │ gzip:  51.55 kB
dist/assets/html2canvas.esm-CBrSDip1.js                 201.42 kB │ gzip:  48.03 kB
dist/assets/index-CwZzGJVp.js                         2,808.40 kB │ gzip: 794.94 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 5.14s
EXIT_CODE=0
```

## Kommando: npm run lint
```
$ npm run lint

> vite_react_shadcn_ts@0.0.0 lint
> eslint .


/home/klaus999/projects/naturheilpraxis-rauch/src/components/admin/AuditLogManager.tsx
  57:59  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/admin/ICD10Generator.tsx
   76:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  149:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  160:33  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  161:33  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/admin/KnowledgeBaseManager.tsx
  208:40  warning  React Hook useEffect has a missing dependency: 'fetchEntries'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/home/klaus999/projects/naturheilpraxis-rauch/src/components/admin/MannayanPriceManager.tsx
   62:38  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   72:68  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   84:68  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   84:89  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   97:68  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  108:68  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  108:89  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  115:18  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  179:72  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  181:22  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  196:66  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  204:97  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  207:80  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  212:29  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  219:25  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  222:38  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  237:64  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  658:38  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/admin/PatientLibraryManager.tsx
  100:17  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/admin/PatientManager.tsx
   47:6   warning  React Hook useEffect has a missing dependency: 'fetchPatients'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
  110:19  error    Unexpected any. Specify a different type                                                                          @typescript-eslint/no-explicit-any
  124:28  error    Unexpected any. Specify a different type                                                                          @typescript-eslint/no-explicit-any
  131:54  error    Unexpected any. Specify a different type                                                                          @typescript-eslint/no-explicit-any
  146:19  error    Unexpected any. Specify a different type                                                                          @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/admin/PricingManager.tsx
  75:81  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/admin/TagEnrichmentDialog.tsx
  64:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  65:16  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/admin/TherapyRecommendation.tsx
   185:50  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
   192:21  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
   235:13  error    Empty block statement                                                                                                                                                                                 no-empty
   248:13  error    Empty block statement                                                                                                                                                                                 no-empty
   251:45  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
   285:20  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
   292:13  error    Empty block statement                                                                                                                                                                                 no-empty
   297:6   warning  React Hook useEffect has a missing dependency: 'loadCloudDraft'. Either include it or remove the dependency array                                                                                     react-hooks/exhaustive-deps
   299:69  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
   301:43  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
   313:21  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
   335:39  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
   338:32  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
   396:48  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
   408:52  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
   466:43  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
   511:13  error    Empty block statement                                                                                                                                                                                 no-empty
   512:6   warning  React Hook useEffect has a missing dependency: 'toast'. Either include it or remove the dependency array                                                                                              react-hooks/exhaustive-deps
   525:13  error    Empty block statement                                                                                                                                                                                 no-empty
   613:17  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
   673:41  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
   891:57  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
   906:17  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
   953:72  error    Empty block statement                                                                                                                                                                                 no-empty
   954:94  error    Empty block statement                                                                                                                                                                                 no-empty
   955:80  error    Empty block statement                                                                                                                                                                                 no-empty
  1007:42  error    Unexpected any. Specify a different type                                                                                                                                                              @typescript-eslint/no-explicit-any
  1020:80  error    Empty block statement                                                                                                                                                                                 no-empty
  1021:80  error    Empty block statement                                                                                                                                                                                 no-empty
  2194:9   warning  The 'introSections' conditional could make the dependencies of useMemo Hook (at line 2206) change on every render. To fix this, wrap the initialization of 'introSections' in its own useMemo() Hook  react-hooks/exhaustive-deps
  2216:6   warning  React Hook useEffect has a missing dependency: 'allKeys'. Either include it or remove the dependency array                                                                                            react-hooks/exhaustive-deps
  2216:7   warning  React Hook useEffect has a complex expression in the dependency array. Extract it to a separate variable so it can be statically checked                                                              react-hooks/exhaustive-deps

/home/klaus999/projects/naturheilpraxis-rauch/src/components/admin/therapy/LabImageUpload.tsx
   67:53  error  Empty block statement                     no-empty
  117:17  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/admin/therapy/PathogenInput.tsx
   20:14  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components
   32:17  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components
   50:17  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components
   73:14  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components
  119:17  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components
  144:17  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components
  153:28  error    Unnecessary escape character: \|                                                                                                no-useless-escape
  155:33  error    Unnecessary escape character: \|                                                                                                no-useless-escape
  157:33  error    Unnecessary escape character: \|                                                                                                no-useless-escape
  197:63  error    Unnecessary escape character: \|                                                                                                no-useless-escape

/home/klaus999/projects/naturheilpraxis-rauch/src/components/admin/therapy/PseudonymHistory.tsx
   15:18  error    Unexpected any. Specify a different type                                                                                        @typescript-eslint/no-explicit-any
   60:28  error    Unexpected any. Specify a different type                                                                                        @typescript-eslint/no-explicit-any
   72:42  error    Unexpected any. Specify a different type                                                                                        @typescript-eslint/no-explicit-any
   82:42  error    Unexpected any. Specify a different type                                                                                        @typescript-eslint/no-explicit-any
  310:17  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/klaus999/projects/naturheilpraxis-rauch/src/components/admin/therapy/TherapyPatientOverview.tsx
   30:18  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   77:30  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   99:34  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  122:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/AllergiesSection.tsx
  17:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  23:50  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  30:73  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/CancerSection.tsx
  28:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  34:56  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  41:73  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/ComplaintsSection.tsx
  13:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  19:52  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/DentalSection.tsx
   14:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   24:55  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   31:76  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  175:76  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/DigestiveSection.tsx
  10:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  16:48  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  25:64  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/EnvironmentSection.tsx
  12:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  22:77  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  35:77  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/FamilyHistorySection.tsx
   9:42   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  31:97   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  62:108  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/FilteredSummaryView.tsx
  12:29  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  25:31  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/HeartSection.tsx
  11:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  17:54  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  26:64  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  43:28  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/HormoneSection.tsx
  15:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  23:59  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  29:92  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/InfectionsSection.tsx
  17:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  23:52  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  30:73  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/KidneySection.tsx
  10:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  16:49  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  25:64  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/LifestyleSection.tsx
  31:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  37:52  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  44:73  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  59:64  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  65:59  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  71:73  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  76:66  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/LiverSection.tsx
  10:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  16:49  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  25:64  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/LungSection.tsx
  10:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  16:53  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  25:64  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/MedicalHistorySection.tsx
   17:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   39:87  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   40:68  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   48:70  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   49:68  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   56:34  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   71:38  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   98:72  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  159:72  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  425:58  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  430:50  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  433:74  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  472:60  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  515:58  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  560:56  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  602:57  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  642:57  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  761:66  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/MedicationsSection.tsx
  14:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  20:52  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  27:73  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  48:66  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  67:74  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/MensHealthSection.tsx
   12:42   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   22:58   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   29:73   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   40:108  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   53:108  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   70:108  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  174:73   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/MusculoskeletalSection.tsx
  13:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  21:58  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  27:92  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/NeurologySection.tsx
  16:42   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  24:57   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  25:57   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  31:109  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  32:34   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  44:70   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  45:34   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  56:79   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/PatientDataSection.tsx
   16:42   error    Unexpected any. Specify a different type                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
   28:6    warning  React Hook React.useEffect has missing dependencies: 'formData.email' and 'updateFormData'. Either include them or remove the dependency array. If 'updateFormData' changes too often, find the parent component that defines it and wrap that definition in useCallback                 react-hooks/exhaustive-deps
   33:27   error    Unnecessary escape character: \-                                                                                                                                                                                                                                                         no-useless-escape
   88:6    warning  React Hook React.useEffect has missing dependencies: 'formData.sorgeberechtigterTyp' and 'updateFormData'. Either include them or remove the dependency array. If 'updateFormData' changes too often, find the parent component that defines it and wrap that definition in useCallback  react-hooks/exhaustive-deps
  709:60   error    Unexpected any. Specify a different type                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  709:95   error    Unexpected any. Specify a different type                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  717:40   error    Unexpected any. Specify a different type                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  717:75   error    Unexpected any. Specify a different type                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  717:112  error    Unexpected any. Specify a different type                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  725:53   error    Unexpected any. Specify a different type                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  765:53   error    Unexpected any. Specify a different type                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  779:49   error    Unexpected any. Specify a different type                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  788:41   error    Unexpected any. Specify a different type                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  788:77   error    Unexpected any. Specify a different type                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/PreferencesSection.tsx
  11:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  17:64  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/SignatureSection.tsx
  15:42  error    Unexpected any. Specify a different type                                                                                                                                                                                                                                         @typescript-eslint/no-explicit-any
  43:35  error    Unexpected any. Specify a different type                                                                                                                                                                                                                                         @typescript-eslint/no-explicit-any
  56:6   warning  React Hook React.useEffect has missing dependencies: 'formData.unterschrift' and 'updateFormData'. Either include them or remove the dependency array. If 'updateFormData' changes too often, find the parent component that defines it and wrap that definition in useCallback  react-hooks/exhaustive-deps
  75:6   warning  React Hook React.useEffect has missing dependencies: 'formData.unterschrift' and 'updateFormData'. Either include them or remove the dependency array. If 'updateFormData' changes too often, find the parent component that defines it and wrap that definition in useCallback  react-hooks/exhaustive-deps
  98:53  error    Unexpected any. Specify a different type                                                                                                                                                                                                                                         @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/SocialSection.tsx
  11:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  17:49  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/SurgeriesSection.tsx
   20:42   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   30:60   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   37:73   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   55:112  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   65:112  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   76:112  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  162:61   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  170:67   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  178:69   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  220:34   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  221:50   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  222:51   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  256:76   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  264:68   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  281:70   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  289:68   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  297:71   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  421:66   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  445:106  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/VaccinationsSection.tsx
  11:42  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  21:50  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  28:73  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  38:51  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  48:64  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/WomenHealthSection.tsx
   14:42   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   24:57   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   31:73   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   49:106  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   65:106  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  177:74   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  195:75   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  205:64   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  226:70   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  377:59   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  450:74   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/shared/DentalChart.tsx
  381:10  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/shared/MultiEntryField.tsx
  19:27  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  20:38  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  49:36  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  60:61  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/anamnese/shared/SubConditionList.tsx
  15:30  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  16:59  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/components/hypnose/HypnoseAudioPlayer.tsx
  25:87  error    Unexpected any. Specify a different type                                                                                       @typescript-eslint/no-explicit-any
  70:6   warning  React Hook useEffect has missing dependencies: 'ambientVol' and 'playing'. Either include them or remove the dependency array  react-hooks/exhaustive-deps

/home/klaus999/projects/naturheilpraxis-rauch/src/components/ui/badge.tsx
  30:17  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/klaus999/projects/naturheilpraxis-rauch/src/components/ui/button.tsx
  50:18  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/klaus999/projects/naturheilpraxis-rauch/src/components/ui/command.tsx
  24:11  error  An interface declaring no members is equivalent to its supertype  @typescript-eslint/no-empty-object-type

/home/klaus999/projects/naturheilpraxis-rauch/src/components/ui/form.tsx
  129:10  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/klaus999/projects/naturheilpraxis-rauch/src/components/ui/navigation-menu.tsx
  111:3  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/klaus999/projects/naturheilpraxis-rauch/src/components/ui/sidebar.tsx
  636:3  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/klaus999/projects/naturheilpraxis-rauch/src/components/ui/sonner.tsx
  27:19  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/klaus999/projects/naturheilpraxis-rauch/src/components/ui/textarea.tsx
  5:18  error  An interface declaring no members is equivalent to its supertype  @typescript-eslint/no-empty-object-type

/home/klaus999/projects/naturheilpraxis-rauch/src/components/ui/toggle.tsx
  37:18  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/klaus999/projects/naturheilpraxis-rauch/src/contexts/AuthContext.tsx
  159:6   warning  React Hook useEffect has a missing dependency: 'devBypass'. Either include it or remove the dependency array                    react-hooks/exhaustive-deps
  185:14  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/klaus999/projects/naturheilpraxis-rauch/src/contexts/LanguageContext.tsx
  51:17  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/klaus999/projects/naturheilpraxis-rauch/src/lib/icd10Mapping.ts
  154:60  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  179:30  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  179:50  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  193:66  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/lib/pdfExportEnhanced.ts
   322:40  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   342:67  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   382:60  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   460:45  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   497:45  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   595:37  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   595:70  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  1092:46  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  1182:46  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  1268:21  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  1269:21  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/pages/AnamneseDemo.tsx
  372:49  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  410:87  error  Empty block statement                     no-empty
  416:21  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  440:71  error  Empty block statement                     no-empty
  442:21  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/pages/Anamnesebogen.tsx
  571:52  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  714:49  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  785:21  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  866:35  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  888:21  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/pages/Auth.tsx
   70:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  151:21  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  177:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  236:21  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  284:21  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  341:21  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  415:21  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  472:21  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  504:21  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/src/pages/Erstanmeldung.tsx
  130:6  warning  React Hook useEffect has a missing dependency: 'terminConfirmed'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/home/klaus999/projects/naturheilpraxis-rauch/src/pages/PatientDashboard.tsx
  47:6  warning  React Hook useEffect has a missing dependency: 'fetchSubmissions'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/home/klaus999/projects/naturheilpraxis-rauch/src/pages/Wissensdatenbank.tsx
  35:65  error  Empty block statement  no-empty

/home/klaus999/projects/naturheilpraxis-rauch/supabase/functions/enrich-wiki-tags/index.ts
  124:26  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  155:20  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/supabase/functions/extract-lab-image/index.ts
   78:20  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  103:15  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/supabase/functions/generate-diagnoses/index.ts
  144:20  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  167:15  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/supabase/functions/generate-icd10/index.ts
   88:30  error  Unexpected any. Specify a different type              @typescript-eslint/no-explicit-any
   88:50  error  Unexpected any. Specify a different type              @typescript-eslint/no-explicit-any
   98:53  error  Unexpected any. Specify a different type              @typescript-eslint/no-explicit-any
  116:51  error  Unexpected any. Specify a different type              @typescript-eslint/no-explicit-any
  178:61  error  Unexpected any. Specify a different type              @typescript-eslint/no-explicit-any
  185:9   error  'aiResults' is never reassigned. Use 'const' instead  prefer-const

/home/klaus999/projects/naturheilpraxis-rauch/supabase/functions/get-patients/index.ts
  55:52  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  61:48  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  65:58  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  85:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/supabase/functions/get-therapy-sessions/index.ts
  71:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/supabase/functions/list-therapy-pseudonyms/index.ts
  63:39  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  95:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/supabase/functions/resend-submission/index.ts
   57:30  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   57:50  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   67:53  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   84:51  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  146:22  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  147:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  231:61  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  324:34  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/supabase/functions/send-verification-email/index.ts
  115:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/supabase/functions/submit-anamnesis/index.ts
  102:30  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  102:50  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  112:53  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  129:51  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  191:22  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  192:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  505:37  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  621:39  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/supabase/functions/therapy-recommend/index.ts
   82:42  error  Unnecessary escape character: \-          no-useless-escape
  107:40  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  623:20  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/klaus999/projects/naturheilpraxis-rauch/tailwind.config.ts
  106:13  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

✖ 332 problems (300 errors, 32 warnings)
  1 error and 0 warnings potentially fixable with the `--fix` option.

EXIT_CODE=1
```

## Zusatzprüfung Kommando: npx tsc --noEmit
```
$ npx tsc --noEmit
EXIT_CODE=0
```

