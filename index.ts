import express from 'express';
import path from 'path';
import fs from 'fs';
import { Database } from 'bun:sqlite';
import multer from 'multer';

const db = new Database(path.join(__dirname, "data", "books.db"));

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

app.get('/books/:name', (req, res) => {
    const { name } = req.params;
    const filePath = path.join(__dirname, 'app', 'books', `${name}`);

    res.download(filePath, (err) => {
        if (err) {
            console.error("Download failed:", err);
            res.status(404).send("File not found.");
        }
    });
});

app.post("/api/data", upload.single('file'), async (req, res) => {
    try {
        const { name, author, description, category } = req.body;

        if (!name || !author || !description || !category) {
            return res.status(400).json({ message: "All fields are required." });
        }

        const stmt = db.prepare("SELECT * FROM books WHERE name = ?;");
        const book = stmt.get(name);
        if (book) {
            return res.status(400).json({ message: "Book already exists." });
        }

        await db.exec(`INSERT INTO books (name, author, description, category) VALUES (?, ?, ?, ?);`, [name, author, description, category]);

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

            if (fs.existsSync(newFilePath)) {
                return res.status(400).json({ message: "A file with this name already exists." });
            }

            fs.rename(file.path, newFilePath, (err) => {
                if (err) {
                    return res.status(500).json({ message: "Failed to save the file." });
                }

                const publicLink = `/books/${name}${fileExtension}`;
    
                db.exec(`UPDATE books SET link = ? WHERE name = ?;`, [publicLink, name]);
    
                res.status(201).json({ message: "Book data saved successfully." });
            });
        }

        res.status(201).json({ message: "Book data saved successfully." });
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).json({ message: "Internal server error." });
    }
});

const PORT = 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Listening on port ${PORT}`);
});
