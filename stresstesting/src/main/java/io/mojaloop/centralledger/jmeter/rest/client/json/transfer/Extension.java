package io.mojaloop.centralledger.jmeter.rest.client.json.transfer;

import io.mojaloop.centralledger.jmeter.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONException;
import org.json.JSONObject;

/**
 */
@Getter
@Setter
public class Extension extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private String key;
	private String value;
	public static class JSONMapping {
		public static final String KEY = "key";
		public static final String VALUE = "value";
	}

	/**
	 * Populates local variables with {@code jsonObject}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public Extension(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.KEY)) this.setKey(jsonObject.getString(JSONMapping.KEY));
		if (jsonObject.has(JSONMapping.VALUE)) this.setValue(jsonObject.getString(JSONMapping.VALUE));
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getKey() == null) returnVal.put(JSONMapping.KEY, JSONObject.NULL);
		else returnVal.put(JSONMapping.KEY, this.getKey());

		if (this.getValue() == null) returnVal.put(JSONMapping.VALUE, JSONObject.NULL);
		else returnVal.put(JSONMapping.VALUE, this.getValue());

		return returnVal;
	}
}
