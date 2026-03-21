# 📦 Catalog App — Vercel + Postgres

אפליקציית ניהול וקטלוג פריטים מלאה, מוכנה לפריסה ב-Vercel.

---

## 🗂 מבנה הפרויקט

```
├── index.html          # דף תצוגה ציבורי
├── admin.html          # פאנל ניהול
├── style.css           # עיצוב משותף
├── script.js           # לוגיקת דף הבית
├── admin.js            # לוגיקת פאנל הניהול
├── api/
│   └── items/
│       └── index.js   # Serverless API (GET/POST/PUT/DELETE)
├── vercel.json         # הגדרות Vercel
├── package.json        # תלויות Node.js
├── .env.example        # משתני סביבה לדוגמה
└── README.md
```

---

## ⚙️ הגדרת מסד הנתונים ב-Vercel

### שלב 1 — יצירת Postgres DB

1. היכנס ל-[Vercel Dashboard](https://vercel.com/dashboard)
2. לחץ על **Storage** בתפריט הצדדי
3. לחץ **Create Database** → בחר **Postgres**
4. תן שם ל-DB (לדוגמה: `catalog-db`) ולחץ **Create**

### שלב 2 — חיבור ה-DB לפרויקט

1. בדף ה-DB החדש, לחץ **Connect Project**
2. בחר את הפרויקט שלך
3. Vercel יוסיף אוטומטית את משתני הסביבה הבאים:
   - `POSTGRES_URL`
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NON_POOLING`
   - `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`

> ✅ **הטבלה נוצרת אוטומטית** בקריאה הראשונה ל-API!
> ✅ **6 פריטי דמו** יתווספו אוטומטית אם ה-DB ריק.

---

## 🚀 פריסה ב-Vercel

### אפשרות א' — דרך CLI

```bash
# התקן Vercel CLI
npm i -g vercel

# היכנס לחשבון
vercel login

# פרוס את הפרויקט
cd catalog-app
vercel --prod
```

### אפשרות ב' — דרך GitHub

1. דחוף את הקוד ל-GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/USERNAME/REPO.git
   git push -u origin main
   ```
2. ב-Vercel Dashboard לחץ **Add New Project**
3. בחר את ה-repository מ-GitHub
4. לחץ **Deploy**

---

## 💻 פיתוח מקומי

```bash
# התקן תלויות
npm install

# צור קובץ .env.local עם פרטי ה-DB מ-Vercel
cp .env.example .env.local
# מלא את הערכים מ-Vercel Dashboard → Storage → DB → .env.local tab

# הרץ בסביבת פיתוח
vercel dev
```

פתח בדפדפן: `http://localhost:3000`

---

## 🌐 API Reference

### GET /api/items
מחזיר את כל הפריטים.

**Query params (אופציונלי):**
- `search=מילה` — חיפוש בכותרת/תיאור
- `tag=שם-תגית` — סינון לפי תגית
- `limit=50` — הגבלת כמות (ברירת מחדל: 100)
- `offset=0` — דפדוף (ברירת מחדל: 0)

**Response:**
```json
{
  "items": [...],
  "count": 6
}
```

---

### POST /api/items
הוספת פריט חדש.

**Body:**
```json
{
  "title": "כותרת הפריט",
  "description": "תיאור מפורט",
  "image": "https://example.com/img.jpg",
  "tags": ["תגית1", "תגית2"]
}
```

**Response:** `201 Created`
```json
{
  "item": { "id": 1, "title": "...", ... },
  "message": "פריט נוסף בהצלחה"
}
```

---

### PUT /api/items
עדכון פריט קיים.

**Body:**
```json
{
  "id": 1,
  "title": "כותרת מעודכנת",
  "description": "...",
  "image": "...",
  "tags": ["תגית"]
}
```

**Response:** `200 OK`

---

### DELETE /api/items
מחיקת פריט.

**Body:**
```json
{ "id": 1 }
```

**Response:** `200 OK`

---

## 🗃 סכמת הטבלה

```sql
CREATE TABLE items (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(100) NOT NULL,
  description TEXT,
  image       TEXT,
  tags        JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## ✨ פיצ'רים

| פיצ'ר | תיאור |
|--------|-------|
| 🔍 חיפוש | חיפוש בזמן אמת בכותרות, תיאורים ותגיות |
| 🏷 סינון תגיות | סינון לפי תגית ספציפית |
| ⊞ תצוגת גריד/רשימה | מעבר בין תצוגות |
| ★ מועדפים | שמירת מועדפים ב-localStorage |
| 🌙 Dark Mode | מצב כהה עם זיכרון |
| 💀 Skeleton Loading | אנימציית טעינה |
| 🖼 Lazy Loading | טעינת תמונות חכמה |
| ✅ אימות טפסים | ולידציה בצד הלקוח |
| 🔔 Toast הודעות | התראות הצלחה/שגיאה |
| 📱 Responsive | עיצוב מותאם לנייד |

---

## 🔧 פתרון בעיות נפוצות

**שגיאה: "Cannot find module @vercel/postgres"**
```bash
npm install @vercel/postgres
```

**שגיאה: "POSTGRES_URL is not defined"**
- ודא שחיברת את ה-DB לפרויקט ב-Vercel Dashboard
- הרץ `vercel env pull .env.local` לייבוא משתני הסביבה

**תמונות לא נטענות**
- ודא שה-URL הוא HTTPS ציבורי
- Vercel אוכף HTTPS — כתובות HTTP לא יעבדו בפרודקשן
