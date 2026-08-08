# Project Deployment & Architecture Boundaries

## 1. Web Platform (الموقع الرئيسي للزوار والعملاء ورادار الأوبشن)
- **Local Directory**: `E:\سوفت وير ومنصه وواتس اب api\web Etegah`
- **Vercel Project**: `www.etegah-analysis.com`
- **Live Domain**: `https://www.etegah-analysis.com`
- **Visitor Login**: `https://www.etegah-analysis.com/visitor-login`
- **Firebase Project**: `etegah-dafe5`
- **Deploy Command**: `npx vercel --prod --yes` inside `E:\سوفت وير ومنصه وواتس اب api\web Etegah`
- **Rule**: NEVER push changes from `web Etegah` into `etegah-whatsapp-api` Vercel deployment.

## 2. WhatsApp CRM & Admin/Employee Dashboard (نظام إدارة الواتساب والإدارة والموظفين)
- **Local Directory**: `E:\سوفت وير ومنصه وواتس اب api\etegah-whatsapp-api`
- **Vercel Project**: `etegah-whatsapp-api`
- **Live Domain**: `https://whatsapp.etegah-analysis.com`
- **Admin/Staff Login**: `https://whatsapp.etegah-analysis.com/login`
- **Dashboard**: `https://whatsapp.etegah-analysis.com/dashboard`
- **Firebase Project**: `etegah-dafe5`
- **Deploy Command**: `npx vercel --prod --yes` inside `E:\سوفت وير ومنصه وواتس اب api\etegah-whatsapp-api`
- **Rule**: ALWAYS deploy CRM code directly to `etegah-whatsapp-api` project on Vercel.
