const express = require('express');
const router = express.Router();
const { query } = require('../models/db');
const { param, validationResult } = require('express-validator');

/* GET users listing. */
router.get('/', async function (req, res, next) {
    // res.send('respond with a resource');
    // hämta alla filmer
    // console.table(req.flash('info'));
    // verkar som att meddelandet försvinner efter det hämtats
    try {
        const movies = await query(
            `SELECT movies.*, directors.name AS director
            FROM movies 
            LEFT OUTER JOIN directors ON directors.id = movies.director_id
            ORDER BY imdb_score DESC`
        );

        res.render('movies', {
            title: 'Filmdatabasen',
            movies: movies,
            messages: req.flash('info'),
            errors: req.flash('error')
        });
    } catch (err) {
        console.table(err);
        next(err);
    }
});

router.post('/', async function (req, res, next) {
    console.table(req.body);
    // validation
    try {
        // vi kan inte spara regissörens namn som ett namn i movies utan vi behöver ett id
        // eftersom vi vet att tabellen directors inte tillåter duplicering heller så kan vi inte
        // bara spara direkt i tabellen

        const select = `SELECT id FROM directors WHERE name = ?`;
        let director = await query(select, [req.body.director]);

        if (director.length === 0) {
            const sql = `INSERT INTO directors SET name= ?`;
            director = await query(sql, [req.body.director]);
        }

        console.log(director); // direktorn finns eftersom vi fick ett id // tomt finns inte
        // en ny director gav oss inserId men existerande director har id, viktigt

        // nu kan vi skapa filmen

        const sql = `INSERT INTO movies (title, tagline, release_year, imdb_score, director_id) VALUES (?,?,?,?,?)`;
        const newMovie = await query(sql, [
            req.body.title,
            req.body.tagline,
            req.body.year,
            req.body.imdb_score,
            director.insertId || director[0].id
        ]);

        if (newMovie.insertId > 0) {
            req.flash('info', 'Film med id: ' + newMovie.insertId + ' skapad.');
            res.redirect('/movies/' + newMovie.insertId);
        }
    } catch (err) {
        console.error(err);
        next(err);
    }
    // denna route sparar filmen i databasen
});
// vi behöver en route för att visa formuläret för att skapa en ny film
router.get('/create', function (req, res, next) {
    res.render('movie-create');
});

// ordningen spelar roll för att inte fånga alla requests
router.get('/:id', param('id').isInt(), async function (req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    // hämta en film från db mmed director
    try {
        const sql = `SELECT * FROM movies WHERE id=?`;
        const movie = await query(sql, [req.params.id]);

        res.render('movie', {
            title: 'Filmdatabasen',
            movie: movie[0],
            messages: req.flash('info'),
            errors: req.flash('error')
        });
    } catch (err) {
        console.table(err);
        next(err);
    }
});

// vi behöver en route för att visa formuläret för att uppdatera en film
router.get('/:id/update', param('id').isInt(), async function (req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    // hämta en film från db så vi kan uppdatera dess värden
    try {
        const sql = `SELECT movies.*, directors.name AS director
      FROM movies 
      LEFT OUTER JOIN directors ON directors.id = movies.director_id
      WHERE movies.id = ?`;
        const movie = await query(sql, [req.params.id]);

        // men om det inte finns en film då?
        if (movie.length > 0) {
            res.render('movie-edit', { movie: movie[0] });
        } else {
            res.send('Det finns inte en resurs med id ' + req.params.id);
        }
    } catch (err) {
        console.table(err);
        next(err);
    }
});

router.post('/:id', param('id').isInt(), async function (req, res, next) {
    // notera att hela bodyn behöver valideras och tvättas, req.body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    // precis som för filmen behöver vi undersöka om det finns en director, annars skapa

    const select = `SELECT id FROM directors WHERE name = ?`;
    let director = await query(select, [req.body.director]);

    if (director.length === 0) {
        const sql = `INSERT INTO directors SET name= ?`;
        director = await query(sql, [req.body.director]);
    }

    // kolla så att filmen finns, uppdatera sedan. eller uppdatera direkt

    const sql = `UPDATE movies 
    SET title=?, tagline=?, release_year=?, imdb_score=?, director_id = ?
    WHERE id = ?`;

    // det blir fel med params spread

    const updatedMovie = await query(sql, [
        req.body.title,
        req.body.tagline,
        req.body.year,
        req.body.imdb_score,
        director.insertId || director[0].id,
        req.params.id
    ]);

    if (updatedMovie.affectedRows > 0) {
        req.flash('info', 'Film med id: ' + req.params.id + ' uppdaterad.');
        res.redirect('/movies/' + req.params.id);
    } else {
        req.flash('error', 'Någonting gick snett.');
    }
});

router.get('/:id/delete', param('id').isInt(), async function (req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const sql = `DELETE FROM movies WHERE id = ?`;
    const deleteMovie = await query(sql, [req.params.id]);

    if (deleteMovie.affectedRows > 0) {
        // flash message movie deleted
        req.flash('info', 'Film med id: ' + req.params.id + ' borttagen.');
        res.redirect('/movies');
    }
    // res.send("ta bort film med id " + req.params.id);
});

module.exports = router;
