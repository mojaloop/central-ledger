package io.mojaloop.centralledger.jmeter.rest.client.json;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * <p>
 *     The Mapping object used for any errors thrown
 *     from the Fluid Web Service.
 *
 *     A check may be added to check whether {@code errorCode}
 *     is present.
 */
public class Error extends ABaseJSONObject {

	public static final long serialVersionUID = 1L;

	private int errorCode;
	private String errorMessage;

	/**
	 * The JSON mapping for {@code this} {@code Error} object.
	 */
	public static class JSONMapping {
		public static final String ERROR_INFO = "errorInformation";

		public static final String ERROR_CODE = "errorCode";
		public static final String ERROR_DESC = "errorDescription";
	}

	/**
	 * Default constructor.
	 */
	public Error() {
		super();
	}

	/**
	 * Sets the Error Code and Message.
	 *
	 * @param errorCode Error Code.
	 * @param errorMessage Error Message.
	 */
	public Error(int errorCode, String errorMessage) {
		this.setErrorCode(errorCode);
		this.setErrorMessage(errorMessage);
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public Error(JSONObject jsonObject) {
		super(jsonObject);

		//Error...
		if (!this.JSONObject.isNull(JSONMapping.ERROR_INFO)) {
			JSONObject errorInfo = this.JSONObject.getJSONObject(JSONMapping.ERROR_INFO);

			//Error Code...
			if (!errorInfo.isNull(JSONMapping.ERROR_CODE)) {
				this.setErrorCode(Long.valueOf(errorInfo.getString(JSONMapping.ERROR_CODE)).intValue());
			}

			//Error Description...
			if (!errorInfo.isNull(JSONMapping.ERROR_DESC)) {
				this.setErrorMessage(errorInfo.getString(JSONMapping.ERROR_DESC));
			}
		}
	}

	public boolean isError() {
		return (this.getErrorCode() > 0);
	}

	/**
	 * Gets the Error Code.
	 *
	 * @return Error Code.
	 */
	public int getErrorCode() {
		return this.errorCode;
	}

	/**
	 * Sets the Error Code.
	 *
	 * @param errorCode Error Code.
	 */
	public void setErrorCode(int errorCode) {
		this.errorCode = errorCode;
	}

	/**
	 * Gets the Error Message.
	 *
	 * @return Error Message.
	 */
	public String getErrorMessage() {
		return this.errorMessage;
	}

	/**
	 * Sets the Error Message.
	 *
	 * @param errorMessage Error Message.
	 */
	public void setErrorMessage(String errorMessage) {
		this.errorMessage = errorMessage;
	}

	/**
	 * <p>
	 * Base {@code toJsonObject} that creates a {@code JSONObject}
	 * with the Id and ServiceTicket set.
	 * </p>
	 *
	 * @return {@code JSONObject} representation of {@code ABaseFluidJSONObject}
	 * @throws JSONException If there is a problem with the JSON Body.
	 *
	 * @see JSONObject
	 */
	@Override
	public JSONObject toJsonObject() throws JSONException {

		JSONObject returnVal = super.toJsonObject();
		returnVal.put(JSONMapping.ERROR_CODE, this.getErrorCode());

		//Error Message...
		if (this.getErrorMessage() != null) {
			returnVal.put(JSONMapping.ERROR_DESC,this.getErrorMessage());
		}
		return returnVal;
	}
}
