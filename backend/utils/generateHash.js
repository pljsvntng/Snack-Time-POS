console.error('Legacy plaintext/password-output helper retired. Use npm --prefix backend run admin:setup or admin:reset -- --target cloud|local. Passwords are entered in a hidden terminal prompt.');
process.exitCode=1;
