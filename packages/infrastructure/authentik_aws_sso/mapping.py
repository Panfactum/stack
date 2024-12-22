# Some implementations require givenName and familyName to be set
givenName, familyName = request.user.name, " "
formatted = request.user.name + " "

# This default sets givenName to the name before the first space
# and the remainder as family name
# if the user's name has no space the givenName is the entire name
# (this might cause issues with some SCIM implementations)
if " " in request.user.name:
    givenName, _, familyName = request.user.name.partition(" ")
    formatted = request.user.name

locale = request.user.locale()
if locale == "":
    locale = None

emails = []
if request.user.email != "":
    emails = [{
        "value": request.user.email,
        "type": "other",
        "primary": True,
    }]
return {
    "userName": request.user.email,
    "name": {
        "formatted": formatted,
        "givenName": givenName,
        "familyName": familyName,
    },
    "displayName": request.user.name,
    "locale": locale,
    "active": request.user.is_active,
    "emails": emails,
    "photos": None,
}