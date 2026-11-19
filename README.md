# Savoria — The Art of Dining 🍽️

A modern, elegant, and database-driven restaurant website built with **Next.js, TypeScript, Tailwind CSS, and Neon PostgreSQL**.

Savoria combines a premium restaurant experience with a fully dynamic menu management system. Users can explore the restaurant, view available dishes, add new menu items, and delete existing items. All menu information is stored in a PostgreSQL database and remains available after refreshing the page.

This project was developed as a university practical assignment to demonstrate frontend development, backend API integration, database connectivity, and CRUD operations.

## ✨ Features

### Restaurant Website
- Premium and fully responsive restaurant design.
- Elegant homepage with food photography.
- Modern navigation bar with mobile support.
- About section introducing the restaurant.
- Dynamic menu section.
- Contact section and footer.
- Smooth animations using Motion.
- Beautiful typography and refined color combinations.

### Dynamic Menu Management
- **View Menu:** Retrieve and display all menu items from NeonDB.
- **Add Menu Item:** Add dishes with a name, price, and description.
- **Delete Menu Item:** Remove existing dishes with a confirmation dialog.
- **Database Persistence:** All changes are saved permanently in Neon PostgreSQL.
- **Real-Time UI Updates:** Menu cards update immediately after successful addition or deletion, without requiring a manual refresh.
- **Input Validation:** Required fields and positive prices are validated.
- **Error Handling:** Friendly error messages for failed requests.
- **Loading States:** Skeleton cards appear while menu data is being fetched.
- **Toast Notifications:** Success and error messages provide feedback to users.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Next.js (App Router) | Full-stack web framework |
| React | User interface |
| TypeScript | Type-safe development |
| Tailwind CSS | Responsive styling |
| Neon PostgreSQL | Cloud database |
| @neondatabase/serverless | PostgreSQL database connection |
| Next.js Route Handlers | Backend REST API |
| Lucide React | Icons |
| Motion | Animations |
| Vercel | Website deployment |

## 🎨 Design System

Savoria uses a warm, sophisticated color palette inspired by contemporary fine-dining restaurants.

| Color | Hex Code |
|---|---|
| Espresso Brown | `#241C19` |
| Warm Ivory | `#F9F5EE` |
| Muted Terracotta | `#B96547` |
| Champagne Gold | `#C8A46B` |
| Sage Green | `#66745B` |

**Typography:**
- Playfair Display — headings
- DM Sans — body text

## 📂 Project Structure

```text
savoria/
├── public/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── menu/
│   │   │       ├── route.ts
│   │   │       └── [id]/
│   │   │           └── route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── Hero.tsx
│   │   ├── About.tsx
│   │   ├── MenuManager.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── Contact.tsx
│   │   └── Footer.tsx
│   ├── lib/
│   │   ├── db.ts
│   │   └── validation.ts
│   └── types/
│       └── menu.ts
├── .env.local
├── package.json
├── next.config.ts
├── tsconfig.json
└── README.md
```

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
```

Replace the repository URL and directory name with your actual details.

### 2. Install Dependencies

Make sure Node.js and npm are installed.

```bash
npm install
```

If the required dependencies are missing, install them using:

```bash
npm install @neondatabase/serverless lucide-react motion server-only
```

### 3. Configure NeonDB

1. Visit [Neon Console](https://console.neon.tech/).
2. Create a PostgreSQL database project.
3. Open the SQL Editor.
4. Execute the following SQL:

```sql
CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    description TEXT NOT NULL
);
```

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory, alongside `package.json`.

Add:

```env
DATABASE_URL="your_neondb_connection_string"
```

Replace the placeholder with your actual Neon connection string.

**Security:** Never commit `.env.local` or expose your database credentials in frontend code.

### 5. Run the Development Server

```bash
npm run dev
```

Open:

**http://localhost:3000**

### 6. Build for Production

```bash
npm run build
```

Start the production application locally:

```bash
npm run start
```

## 🔗 API Endpoints

The application uses Next.js Route Handlers to communicate with Neon PostgreSQL.

### GET `/api/menu`

Retrieves all saved menu items.

Example response:

```json
{
  "items": [
    {
      "id": 1,
      "name": "Creamy Chicken Alfredo",
      "price": 1450,
      "description": "Tender grilled chicken served over fettuccine pasta, tossed in a rich Parmesan cream sauce."
    }
  ]
}
```

### POST `/api/menu`

Creates a new menu item.

Example request:

```json
{
  "name": "Classic Margherita Pizza",
  "price": 1650,
  "description": "Hand-stretched pizza dough topped with tomato sauce, fresh mozzarella, and basil."
}
```

Returns HTTP `201 Created` when successful.

### DELETE `/api/menu/[id]`

Deletes the menu item associated with the supplied ID.

Example:

```text
DELETE /api/menu/1
```

Returns a success response after deletion.

## 🗄️ Database Structure

**Table Name:** `menu_items`

| Column | Data Type | Description |
|---|---|---|
| id | INTEGER | Auto-generated primary key |
| name | TEXT | Menu item name |
| price | NUMERIC(10,2) | Menu item price in PKR |
| description | TEXT | Description of the menu item |

The application uses server-side database queries. No menu records are hardcoded into the frontend.

## 🧪 Testing the Application

The following tests can be performed to verify the assignment requirements:

| Test | Expected Result |
|---|---|
| Open homepage | Restaurant website loads |
| Open menu section | Saved menu items appear |
| Add a valid item | New dish appears immediately |
| Refresh the browser | Added dish remains visible |
| Submit empty fields | Validation message appears |
| Submit a negative price | Request is rejected |
| Click Remove | Confirmation dialog appears |
| Confirm deletion | Dish disappears from the menu |
| Refresh after deletion | Deleted dish stays removed |
| Database unavailable | Friendly error message appears |

## 📸 Project Screenshots

Add screenshots of your completed website to the `public/screenshots` folder.

### Homepage

![Savoria Homepage](public/screenshots/homepage.png)

### Dynamic Menu

![Savoria Dynamic Menu](public/screenshots/menu.png)

### Add Menu Item

![Savoria Add Menu Item](public/screenshots/add-item.png)

### Delete Confirmation

![Savoria Delete Confirmation](public/screenshots/delete-confirmation.png)

**Note:** Screenshot paths above will work after the corresponding image files have been added.

## 🌐 Deployment on Vercel

1. Push the project to GitHub.
2. Visit [Vercel](https://vercel.com/).
3. Import the GitHub repository.
4. Select Next.js as the framework.
5. Add the `DATABASE_URL` environment variable.
6. Deploy the application.
7. Test the menu operations on the deployed website.

**Live Website:** Add your Vercel deployment URL here.

## 🔐 Security and Validation

- Database credentials are stored in environment variables.
- PostgreSQL queries use parameterized values.
- Database access is performed on the server.
- Input validation checks required fields and positive prices.
- API errors return appropriate HTTP status codes.
- Delete operations require user confirmation.

**Academic project note:** Menu management endpoints are publicly accessible in this demonstration. A production restaurant website should protect these endpoints with staff authentication and authorization.

## 🎓 Learning Outcomes

Through this project, I practiced:

- Creating a modern website using Next.js App Router.
- Developing reusable React components.
- Using TypeScript for safer application development.
- Designing responsive interfaces with Tailwind CSS.
- Connecting a Next.js application to Neon PostgreSQL.
- Creating REST API endpoints.
- Performing Create, Read, and Delete database operations.
- Handling form validation and API errors.
- Maintaining database persistence after page refresh.
- Deploying full-stack applications to Vercel.

## 👩‍💻 Developer

**Developed by:** [Your Name]

**Course:** [Course Name]

**University:** [University Name]

**GitHub:** [Your GitHub Profile]

## 📄 Project Purpose

This project was developed for educational purposes as part of a university practical assignment.

---

**Savoria — Every Dish Tells a Story.**