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

    const val MISSING_ACTIVITY_ID =
        "Missing activity id"

    const val VISITOR_ALREADY_IN_ACTIVITY =
        "Visitor is already booked in another activity"
}