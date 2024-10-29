import express from 'express';
import path from 'path';
import fs from 'fs';
import { Database } from 'bun:sqlite';
import multer from 'multer';

const db = new Database(path.join(__dirname, "data", "test.db"));

db.run(`
    CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        author TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        link TEXT
    );
`);

const app = express();

const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, "app")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/create", (req, res) => {
    res.sendFile(path.join(__dirname, "app", "create.html"));
});

app.get("/api/books", (req, res) => {
    const stmt = db.query("SELECT * FROM books;");
    const books = stmt.all();
    res.json(books);
});

app.post("/api/data", upload.single('file'), (req: any, res: any) => {
    const { name, author, description, category } = req.body;

    if (!name || !author || !description || !category) {
        return res.status(400).json({ message: "All fields are required." });
    }

    const stmt = db.prepare("SELECT * FROM books WHERE name = ?;");
    const book = stmt.get(name);
    if (book) {
        return res.status(400).json({ message: "Book already exists." });
    }

    db.exec(`
        INSERT INTO books (name, author, description, category) VALUES (?, ?, ?, ?);
    `, [name, author, description, category]);

    const file = req.file;
    if (file) {
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const allowedExtensions = ['.epub', '.mobi'];

        if (!allowedExtensions.includes(fileExtension)) {
            return res.status(400).json({
                message: `File must be one of the following formats: ${allowedExtensions.join(', ')}.`
            });
        }

        const targetDir = path.join(__dirname, 'app', 'books');
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const newFilePath = path.join(targetDir, `${name}${fileExtension}`);

        fs.rename(file.path, newFilePath, (err) => {
            if (err) {
                return res.status(500).json({ message: "Failed to save the file." });
            }

            db.exec(`
                UPDATE books SET link = ? WHERE name = ?;
            `, [newFilePath, name]);
        });
    }

    res.status(201).json({ message: "Book data saved successfully." });
});


const PORT = 80;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Listening on port ${PORT}`);
});
