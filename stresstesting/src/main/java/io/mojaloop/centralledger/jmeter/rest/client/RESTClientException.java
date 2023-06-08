package io.mojaloop.centralledger.jmeter.rest.client;

/**
 *
 */
public class RESTClientException extends RuntimeException {
	private int errorCode;

	/**
	 * Mapping of Error codes received from server and local.
	 */
	public static final class ErrorCode {
		public static final int ILLEGAL_STATE_ERROR = 10003;
		public static final int IO_ERROR = 10005;
		public static final int NO_RESULT = 10007;
		public static final int FIELD_VALIDATE = 10008;

		public static final int JSON_PARSING = 10013;

		public static final int CRYPTOGRAPHY = 10018;
		public static final int CONNECT_ERROR = 10019;
	}

	/**
	 * Constructs a new runtime exception with the specified detail message. The
	 * cause is not initialized, and may subsequently be initialized by a call
	 * to {@link #initCause}.
	 *
	 * @param message the detail message. The detail message is saved for later
	 *            retrieval by the {@link #getMessage()} method.
	 * @param errorCode Error code of the {@code Exception}.
	 *
	 */
	public RESTClientException(String message, int errorCode) {
		super(message);
		this.errorCode = errorCode;
	}

	/**
	 * Constructs a new runtime exception with the specified detail message and
	 * cause. <p> Note that the detail message associated with {@code cause} is
	 * <i>not</i> automatically incorporated in this runtime exception's detail
	 * message.
	 *
	 * @param message the detail message (which is saved for later retrieval by
	 *            the {@link #getMessage()} method).
	 * @param cause the cause (which is saved for later retrieval by the
	 *            {@link #getCause()} method). (A {@code null} value is
	 *            permitted, and indicates that the cause is nonexistent or
	 *            unknown.)
	 * @param errorCode Error code of the {@code Exception}.
	 */
	public RESTClientException(String message, Throwable cause, int errorCode) {
		super(message, cause);
		this.errorCode = errorCode;
	}

	/**
	 * Gets the error code for {@code this} Exception.
	 *
	 * @return Numerical error code category for the exception.
	 *
	 * @see ErrorCode
	 */
	public int getErrorCode() {
		return this.errorCode;
	}
}
