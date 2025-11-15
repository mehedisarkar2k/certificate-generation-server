---
applyTo: '**'
---

Don't create any README.md file or any documentation file.

in the env: MONGO_URI and DB_NAME

I need a rest API for serving the following features:

1. authentication using better-auth (https://www.better-auth.com/docs/installation)
2. only authenticated users can access the following features:
   a. Get all the templates
   b. Delete a template, on the deletion part ask for if delete the attached font(s) as well
   c. View a template details -> show a preview (sample), attached font(s), etc.
   d. Create a new template
   i. upload a image (for now store in the telegram, guide me the steps)
   ii. choose data set (cvs, excel, etc.), it'll will not store data in the DB, just will store the field names that needs to be mapped, show previous font from other template (will have a delete font function but, if a font attached to a template it can't be deleted) or upload new font(s)
   iii. template mapping as per the fields name
   iv. save the template
   e. Generate certificates
   i. select a template
   ii. select a data set
   iii. generate certificates
   iv. download the certificates
3. payment system under a package (free - 10 certificates only, standard - 100 certificates, premium - 1000 certificates, custom - contact support)
   a. free package will have a limit of 10 certificates only with "Free" tag on the certificate
   b. each should track which package they have and availability of the generation
   b. also custom package should be checked their generation availability

4. admin panel for managing package, monitor the generation, user details, etc.
   a. manage the packages
   b. monitor the generation
   c. user details
   d. etc.

5. Font my be paid and copyright, so uploaded font should only visible to the corresponding user profile. also delete function should be available to the user profile. only the user can access the font only, even admin will have no access to this

6. check previous code from .old folder, start from scratch using typegoose, express and what is need to complete the project. in the public folder I've frontend code, but now I'll just serve the api only, frontend will be separated within better-auth
