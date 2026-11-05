import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "**/dist/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
      "prefer-const": "warn",
      "no-var": "error",
    },
  },
  {
    // New UI is built from Astryx. The legacy shadcn copies stay only for files not moved yet.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/ui/*"],
              message:
                "Use the Astryx component instead (bunx @astryxdesign/cli@0.7.7 search). Legacy ui/ is being removed.",
            },
          ],
        },
      ],
    },
  },
  {
    // Shrink-only list: remove a file once it no longer imports @/components/ui/*.
    files: [
      "src/components/ui/**",
      "src/app/dashboard/analytics/page.tsx",
      "src/app/dashboard/blocklist/page.tsx",
      "src/app/dashboard/campaigns/new/wizard/page.tsx",
      "src/app/dashboard/campaigns/new/wizard/steps/basic-info.tsx",
      "src/app/dashboard/campaigns/new/wizard/steps/contact-assignment.tsx",
      "src/app/dashboard/campaigns/new/wizard/steps/email-sequence.tsx",
      "src/app/dashboard/campaigns/new/wizard/steps/mailboxes.tsx",
      "src/app/dashboard/campaigns/page.tsx",
      "src/app/dashboard/contacts/[[]id]/page.tsx",
      "src/app/dashboard/contacts/page.tsx",
      "src/app/dashboard/layout.tsx",
      "src/app/dashboard/mailboxes/add-mailbox-dialog.tsx",
      "src/app/dashboard/mailboxes/page.tsx",
      "src/app/dashboard/page.tsx",
      "src/app/dashboard/settings/page.tsx",
      "src/app/design/components.tsx",
      "src/app/design/page.tsx",
      "src/app/sign-in/page.tsx",
      "src/app/sign-up/page.tsx",
      "src/components/accept-invitation.tsx",
      "src/components/add-contacts-wizard/index.tsx",
      "src/components/add-contacts-wizard/shared.tsx",
      "src/components/add-contacts-wizard/success.tsx",
      "src/components/api-keys.tsx",
      "src/components/app-sidebar.tsx",
      "src/components/data-table.tsx",
      "src/components/hosted-auth.tsx",
      "src/components/landing.tsx",
      "src/components/members-roles.tsx",
      "src/components/notifications.tsx",
      "src/components/site.tsx",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "prefer-const": "warn",
      "no-var": "error",
    },
  },
];

export default eslintConfig;
