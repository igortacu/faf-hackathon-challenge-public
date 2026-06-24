package domain.error

object ActivityErrors {

    const val ACTIVITY_NOT_FOUND =
        "Activity not found"

    const val ACTIVITY_FULL =
        "Activity is full"

    const val ACTIVITY_ALREADY_BOOKED =
        "Already booked"

    const val ACTIVITY_NOT_BOOKED =
        "Activity not booked"

    const val VISITOR_ALREADY_IN_ACTIVITY =
        "Visitor is already in this activity"

    const val MISSING_ACTIVITY_ID =
        "Missing activity id"

    const val ACTIVITY_ALREADY_EXISTS =
        "Activity with this id already exists"

    const val MISSING_ACTIVITY_NAME =
        "Missing activity name"

    const val INVALID_CAPACITY =
        "Capacity must be greater than zero"

    const val UNAUTHORIZED =
        "Admin or internal authentication required"
}