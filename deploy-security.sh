#!/bin/bash
set -e

echo "▶ [1/5] Firestore rules..."
npx firebase-tools deploy --only firestore:rules --project ashbis-ae5b2

echo "▶ [2/5] Configurando Gemini key..."
if [ -z "$GEMINI_KEY" ]; then
  read -s -p "Ingresa tu Gemini API key: " GEMINI_KEY
  echo ""
fi
if [ -n "$GEMINI_KEY" ]; then
  npx firebase-tools functions:config:set gemini.key="$GEMINI_KEY" --project ashbis-ae5b2
fi

echo "▶ [3/5] Functions..."
npx firebase-tools deploy --only functions --project ashbis-ae5b2

echo "▶ [4/5] Storage rules..."
npx firebase-tools deploy --only storage --project ashbis-ae5b2 || \
  echo "⚠ Storage no habilitado aún. Habilítalo en Firebase Console y ejecuta: npx firebase-tools deploy --only storage"

echo "▶ [5/5] Build + Hosting..."
# Fix CSS conocido
sed -i 's/border-bottom: 3px solid rojo #8b0808;/border-bottom: 3px solid #8b0808;/g' src/app/home/home.component.scss 2>/dev/null || true
npm run build
npx firebase-tools deploy --only hosting --project ashbis-ae5b2

echo ""
echo "✅ Deploy completado"
echo "🔒 Verifica headers: https://securityheaders.com/?q=https://ashbis-ae5b2.web.app"
echo ""
echo "Pendientes manuales:"
echo "  1. Habilitar Storage en consola si falló el paso 4"
echo "  2. Crear site key reCAPTCHA v3 en google.com/recaptcha/admin/create"
echo "     y pegarlo en environment.appCheckSiteKey de ambos environment files"
echo "  3. Restringir API key Firebase en console.cloud.google.com/apis/credentials?project=ashbis-ae5b2"
