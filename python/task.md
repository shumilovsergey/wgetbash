i wannt u to make new version of this project
https://github.com/shumilovsergey/sh-wgetbash

but we dont need this authentification. i got this authentificztion server:
here is readme instruction
https://github.com/shumilovsergey/auth-center/blob/main/README.md

and here is url 
https://auth-center.sh-development.ru/

so letscreate new app based on containerised python docker-compose
lets create tokens and all this staff to make wgetbash work with auth center. 

about app wgetbash - idea is. every user has hes own script collection, where is groups and skills
every user have auth_id - that we get from auth center and user_name - just name of account ( lable) 
so users script and group collection are privat, but every script will have unical hash id, and if user make GET wget request with right user id/script hash - then we return raw script, so it will run on users server imideatly. the mechanix of this u can fined in aldwgetbash version. for storing user data id like to have sqlite db



