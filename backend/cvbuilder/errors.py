from rest_framework.exceptions import APIException


class CvError(APIException):
    def __init__(self, message, status_code=400, code="cv_error"):
        self.status_code = status_code
        super().__init__(message, code)
