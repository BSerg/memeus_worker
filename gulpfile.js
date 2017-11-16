const gulp = require('gulp');
const babel = require('gulp-babel');
const rename = require('gulp-rename');
const rsync = require('gulp-rsync');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');

const getBuildPath = () => {
    return __dirname + (process.env.NODE_ENV == 'local' ? '/dist' : `/dist/${process.env.NODE_ENV}`);
}

gulp.task('env', () => {
    return gulp.src(`envs/${process.env.NODE_ENV}.env`).pipe(rename('.env')).pipe(gulp.dest(getBuildPath()));
});

gulp.task('package.json', () => {
    var packageJson = Object.assign({}, require('./package.json'));
    packageJson.name = process.env.NODE_ENV != 'production' ? `${packageJson.name}_${process.env.NODE_ENV}` : packageJson.name;
    delete packageJson.scripts;
    delete packageJson.devDependencies;
    delete packageJson.nodemonConfig;
    mkdirp(getBuildPath(), () => {
        fs.writeFileSync(getBuildPath() + '/package.json', JSON.stringify(packageJson, null, 4));
    })
});

gulp.task('newrelic', () => {
    return gulp.src(`newrelic.js`).pipe(gulp.dest(getBuildPath()) + '/server');
});

gulp.task('babel', () => {
    gulp
        .src('src/**')
        .pipe(babel())
        .pipe(gulp.dest(getBuildPath()))
});

gulp.task('deploy', () => {
    var buildRoot = `dist/${process.env.NODE_ENV}`
    return gulp.src(`${buildRoot}/**/*`, {dot: true}).pipe(rsync({
      root: buildRoot,
      hostname: 'app001.memeus.ru',
      username: 'memeus',
      destination: '/home/memeus/www/memeus_worker'
    }))
});

gulp.task('default', ['babel', 'env', 'package.json', 'newrelic']);