library(rmongodb)

m <- mongo.create()
ns <- "sesn.status"

json <- '{"lang":"en"}'
bson <- mongo.bson.from.JSON(json)
cursor <- mongo.find(m, ns, bson)
while(mongo.cursor.next(cursor)) {
  value <- mongo.cursor.value(cursor)
  list <- mongo.bson.to.list(value)
  str(list)
}
