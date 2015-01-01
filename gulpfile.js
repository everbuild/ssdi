var gulp = require('gulp');
var uglify = require('gulp-uglify');
var prefix = require('gulp-autoprefixer');
var ngAnnotate = require('gulp-ng-annotate');
var jsHint = require('gulp-jshint');
var rev = require('gulp-rev');
var liveReload = require('gulp-livereload');
var http = require('http');
var url = require('url');
var proxy = require('proxy-middleware');
var connect = require('connect');
var morgan = require('morgan');
var serveStatic = require('serve-static');
var clean = require('gulp-clean');
var templateCache = require('gulp-angular-templatecache');
var sass = require('gulp-sass');
var through = require('through2');
var streamqueue = require('streamqueue');
var es = require('event-stream');
var useref = require('gulp-useref');
var gulpFilter = require('gulp-filter');
var concat = require('gulp-concat');
var rename = require('gulp-rename');


var srcPath = 'src/main/site';
var jsPath = ['src/**/*.js', 'example/**/*.js'];
var templatesPath = srcPath + '/js/templates/*.html';
var imgPath = srcPath + '/img/**/*';
var htmlPath = srcPath + '/*.html';
var scssPath = srcPath + '/scss/**/*.scss';

var targetPath = 'target';

var tempPath = targetPath + '/tmp';
var cssPath = tempPath + '/css';

var distPath = targetPath + '/dist';


gulp.task('js-hint', function () {
    return gulp.src(jsPath)
        .pipe(jsHint())
        .pipe(jsHint.reporter('jshint-stylish'));
});


gulp.task('watch', ['sass'], function () {
    gulp.watch(jsPath, ['js-hint']);
});


gulp.task('useref', ['clean', 'js-hint'], function () {

    var assets = useref.assets();

    return gulp.src(htmlPath)
        .pipe(assets)

        .pipe(concat('js/ssdi-full.js'))
        .pipe(uglify())
        .pipe(rev())

        .pipe(assets.restore())
        .pipe(useref())
        .pipe(gulp.dest(distPath));
});


gulp.task('serve', function (done) {
    var app = connect()
        .use(morgan('dev'))
        .use(serveStatic('.'));

    http.createServer(app).listen(8888);
	
	done();
});

gulp.task('clean', function () {
    return gulp.src(targetPath, {read: false}).pipe(clean());
});


gulp.task('dist', ['clean', 'useref'], function () {
    return gulp.src([imgPath, htmlPath])
        .pipe(gulp.dest(distPath));
});

gulp.task('dev', ['watch', 'serve', 'live']);


gulp.task('default', ['dist']);
