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
public class Amount extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private String currency;
	private Long amount;

	public static class JSONMapping {
		public static final String CURRENCY = "currency";
		public static final String AMOUNT = "amount";
	}

	/**
	 * Populates local variables with {@code jsonObject}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public Amount(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.CURRENCY)) this.setCurrency(jsonObject.getString(JSONMapping.CURRENCY));
		if (jsonObject.has(JSONMapping.AMOUNT) && !jsonObject.isNull(JSONMapping.AMOUNT)) {
			this.setAmount(jsonObject.getNumber(JSONMapping.AMOUNT).longValue());
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getCurrency() == null) returnVal.put(JSONMapping.CURRENCY, JSONObject.NULL);
		else returnVal.put(JSONMapping.CURRENCY, this.getCurrency());

		if (this.getAmount() == null) returnVal.put(JSONMapping.AMOUNT, JSONObject.NULL);
		else returnVal.put(JSONMapping.AMOUNT, this.getAmount());

		return returnVal;
	}
}
