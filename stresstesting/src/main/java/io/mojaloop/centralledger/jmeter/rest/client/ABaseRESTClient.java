package io.mojaloop.centralledger.jmeter.rest.client;

import io.mojaloop.centralledger.jmeter.rest.client.json.ABaseJSONObject;
import io.mojaloop.centralledger.jmeter.rest.client.json.Error;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.apache.http.HttpEntity;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.ResponseHandler;
import org.apache.http.client.methods.*;
import org.apache.http.conn.ssl.SSLConnectionSocketFactory;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.ssl.SSLContextBuilder;
import org.apache.http.ssl.TrustStrategy;
import org.apache.http.util.EntityUtils;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import javax.net.ssl.SSLContext;
import java.io.File;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.ConnectException;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.security.KeyManagementException;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.List;

/**
 * Base class for all REST related calls.
 *
 * Makes use of AutoCloseable to close streams.
 *
 * @see JSONObject
 * @see HttpEntity
 * @see HttpResponse
 * @see HttpClient
 * @see ContentType
 * @see StringEntity
 *
 * @see AutoCloseable
 */
public abstract class ABaseRESTClient implements AutoCloseable {
	public static final String CONTENT_TYPE_HEADER = "Content-type";

	//Protected variables used by subclasses...
	protected String endpointUrl = "https://localhost/";
	public static final String ENCODING_UTF_8 = "UTF-8";

	private static String EQUALS = "=";
	private static String AMP = "&";

	private static String REGEX_AMP = "\\&";
	private static String REGEX_EQUALS = "\\=";

	public static boolean IS_IN_JUNIT_TEST_MODE = false;

	private CloseableHttpClient closeableHttpClient;

	public static String SYSTEM_PROP_TRUST_STORE = "centralledger.httpclient.truststore";
	public static String SYSTEM_PROP_TRUST_STORE_PASSWORD = "centralledger.httpclient.truststore.password";

	/**
	 * The HTML Form Name and Value mapping.
	 */
	@RequiredArgsConstructor
	@Getter
	public static class FormNameValue {
		private final String name;
		private final String value;
	}

	/**
	 * The HTML Header Name and Value mapping.
	 */
	@RequiredArgsConstructor
	@Getter
	public static class HeaderNameValue {
		private final String name;
		private final String value;
	}

	/**
	 * The HTTP Method type to use.
	 *
	 * See: https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol#Request_methods
	 */
	protected enum HttpMethod {
		GET,
		POST,
		PUT,
		DELETE
	}

	/**
	 * Creates a new client and sets the Base Endpoint URL.
	 *
	 * @param endpointBaseUrl URL to base endpoint.
	 */
	public ABaseRESTClient(String endpointBaseUrl) {
		super();
		if (endpointBaseUrl == null || endpointBaseUrl.trim().isEmpty()) {
			this.endpointUrl = "http://localhost";
		} else {
			this.endpointUrl = endpointBaseUrl;
		}
	}

	/**
	 * Performs an HTTP request with {@code postfixUrlParam} on {@code httpClientParam}.
	 *
	 * @param httpClientParam The Apache Http Client to use.
	 * @param httpUriRequestParam The Apache URI Request.
	 * @param responseHandlerParam The response from the request handler.
	 * @param postfixUrlParam URL mapping after the Base endpoint.
	 * @return Return body as JSON.
	 *
	 * @see HttpClient
	 * @see HttpUriRequest
	 * @see ResponseHandler
	 */
	private String executeHttp(
		HttpClient httpClientParam,
		HttpUriRequest httpUriRequestParam,
		ResponseHandler responseHandlerParam,
		String postfixUrlParam
	) {
		try {
			Object returnedObj = httpClientParam.execute(httpUriRequestParam, responseHandlerParam);

			//String text came back...
			if (returnedObj instanceof String) {
				return (String)returnedObj;
			} else if (returnedObj == null) {
				//[null] - came back...
				throw new RESTClientException(
						"No results, [null] response.",
						RESTClientException.ErrorCode.NO_RESULT);
			}

			throw new RESTClientException(
					"Expected 'String' got '"+(
							(returnedObj == null) ? null:returnedObj.getClass().getName())+"'.",
					RESTClientException.ErrorCode.ILLEGAL_STATE_ERROR);
		} catch (IOException except) {
			//IO Problem...
			if (except instanceof UnknownHostException) {
				throw new RESTClientException(
						"Unable to reach host '"+
								this.endpointUrl.concat(postfixUrlParam)+"'. "+except.getMessage(),
						except, RESTClientException.ErrorCode.CONNECT_ERROR);
			}

			if (except instanceof ConnectException) {
				throw new RESTClientException(except.getMessage(),
						except,
						RESTClientException.ErrorCode.CONNECT_ERROR);
			}
			throw new RESTClientException(
					except.getMessage(),
					except,
					RESTClientException.ErrorCode.IO_ERROR);
		}
	}

	/**
	 * Performs an HTTP-GET request with {@code postfixUrlParam}.
	 *
	 * @param postfixUrlParam URL mapping after the Base endpoint.
	 *
	 * @return Return body as JSON.
	 *
	 * @see JSONObject
	 */
	public JSONObject getJson(
		String postfixUrlParam
	) {
		return this.getJson(postfixUrlParam, null);
	}

	/**
	 * Performs an HTTP-GET request with {@code postfixUrlParam}.
	 *
	 * @param postfixUrlParam URL mapping after the Base endpoint.
	 * @param headerNameValues The HTTP Headers to include.
	 *
	 * @return Return body as JSON.
	 *
	 * @see JSONObject
	 */
	public JSONObject getJson(
		String postfixUrlParam,
		List<HeaderNameValue> headerNameValues
	) {
		CloseableHttpClient httpclient = this.getClient();
		try {
			String completeUri = this.endpointUrl.concat(postfixUrlParam);
			HttpGet httpGet = new HttpGet(completeUri);

			if (headerNameValues != null && !headerNameValues.isEmpty()) {
				headerNameValues.stream()
						.filter(hdrItm -> hdrItm.getName() != null && !hdrItm.getName().trim().isEmpty())
						.filter(hdrItm -> hdrItm.getValue() != null && !hdrItm.getValue().trim().isEmpty())
						.forEach(hdrItm -> {
							httpGet.setHeader(hdrItm.getName(), hdrItm.getValue());
						});
			}

			// Create a custom response handler
			ResponseHandler<String> responseHandler = this.getJsonResponseHandler(this.endpointUrl.concat(postfixUrlParam));
			String responseBody = this.executeHttp(httpclient, httpGet, responseHandler, postfixUrlParam);
			if (responseBody == null || responseBody.trim().isEmpty()) {
				throw new RESTClientException(
						"No response data from '"+ this.endpointUrl.concat(postfixUrlParam)+"'.", RESTClientException.ErrorCode.IO_ERROR);
			}

			JSONObject jsonOjb = null;
			if (responseBody.startsWith("[")) {
				JSONArray jsonArray = new JSONArray(responseBody);
				if (jsonArray.length() > 0) jsonOjb = jsonArray.getJSONObject(0);
			} else {
				jsonOjb = new JSONObject(responseBody);
			}

			Error err = new Error(jsonOjb);
			if (err.isError()) throw new RESTClientException(err.getErrorMessage(), err.getErrorCode());

			return jsonOjb;
		} catch (JSONException jsonExcept) {
			throw new RESTClientException(jsonExcept.getMessage(), RESTClientException.ErrorCode.JSON_PARSING);
		}
	}

	/**
	 * Performs an HTTP-GET request with {@code postfixUrlParam}.
	 *
	 * @param postfixUrlParam URL mapping after the Base endpoint.
	 * @param headerNameValues The HTTP Headers to include.
	 *
	 * @return Return body as JSON.
	 *
	 * @see JSONArray
	 */
	public JSONArray getJsonArray(
		String postfixUrlParam,
		List<HeaderNameValue> headerNameValues
	) {
		CloseableHttpClient httpclient = this.getClient();
		try {
			String completeUri = this.endpointUrl.concat(postfixUrlParam);
			HttpGet httpGet = new HttpGet(completeUri);

			if (headerNameValues != null && !headerNameValues.isEmpty()) {
				headerNameValues.stream()
						.filter(hdrItm -> hdrItm.getName() != null && !hdrItm.getName().trim().isEmpty())
						.filter(hdrItm -> hdrItm.getValue() != null && !hdrItm.getValue().trim().isEmpty())
						.forEach(hdrItm -> {
							httpGet.setHeader(hdrItm.getName(), hdrItm.getValue());
						});
			}

			// Create a custom response handler
			ResponseHandler<String> responseHandler = this.getJsonResponseHandler(this.endpointUrl.concat(postfixUrlParam));
			String responseBody = this.executeHttp(httpclient, httpGet, responseHandler, postfixUrlParam);
			if (responseBody == null || responseBody.trim().isEmpty()) {
				throw new RESTClientException(
						"No response data from '"+ this.endpointUrl.concat(postfixUrlParam)+"'.", RESTClientException.ErrorCode.IO_ERROR);
			}

			if (responseBody.startsWith("[")) return new JSONArray(responseBody);

			JSONObject jsonOjb = new JSONObject(responseBody);
			Error err = new Error(jsonOjb);
			if (err.isError()) throw new RESTClientException(err.getErrorMessage(), err.getErrorCode());

			return new JSONArray(responseBody);
		} catch (JSONException jsonExcept) {
			throw new RESTClientException(jsonExcept.getMessage(), RESTClientException.ErrorCode.JSON_PARSING);
		}
	}

	/**
	 * Performs an HTTP-POST request with {@code postfixUrlParam}.
	 *
	 * @param headerNameValuesParam The additional HTTP headers.
	 * @param baseDomainParam The base domain to convert to JSON and POST
	 *                        to {@code this} endpoint.
	 * @param postfixUrlParam URL mapping after the Base endpoint.
	 * @return Return body as JSON.
	 *
	 * @see JSONObject
	 * @see ABaseJSONObject
	 */
	protected JSONObject postJson(
			List<HeaderNameValue> headerNameValuesParam,
			ABaseJSONObject baseDomainParam,
			String postfixUrlParam
	) {
		return this.executeJson(
				HttpMethod.POST,
				headerNameValuesParam,
				baseDomainParam,
				ContentType.APPLICATION_JSON,
				postfixUrlParam);
	}

	/**
	 * Performs an HTTP-POST request with {@code postfixUrlParam}.
	 *
	 * @param baseDomain The base domain to convert to JSON and POST
	 *                        to {@code this} endpoint.
	 * @param postfixUrl URL mapping after the Base endpoint.
	 * @return Return body as JSON.
	 *
	 * @see JSONObject
	 * @see ABaseJSONObject
	 */
	protected JSONObject postJson(
			ABaseJSONObject baseDomain,
			String postfixUrl
	) {
		return this.executeJson(
				HttpMethod.POST,
				null,
				baseDomain,
				ContentType.APPLICATION_JSON,
				postfixUrl);
	}

	/**
	 * Performs an HTTP-DELETE request with {@code postfixUrlParam}.
	 *
	 * @param baseDomainParam The base domain to convert to JSON and DELETE
	 *                        to {@code this} endpoint.
	 * @param postfixUrlParam URL mapping after the Base endpoint.
	 * @return Return body as JSON.
	 *
	 * @see JSONObject
	 */
	protected JSONObject deleteJson(
			ABaseJSONObject baseDomainParam,
			String postfixUrlParam
	) {
		return this.executeJson(
				HttpMethod.DELETE,
				null,
				baseDomainParam,
				ContentType.APPLICATION_JSON,
				postfixUrlParam);
	}

	/**
	 * Performs an HTTP-POST request with {@code postfixUrlParam} making use of
	 * form params as {@code formNameValuesParam}.
	 *
	 * @param formNameValuesParam The name and value pairs of form data.
	 * @param postfixUrlParam URL mapping after the Base endpoint.
	 * @return Return body as JSON.
	 */
	protected JSONObject postForm(
			List<FormNameValue> formNameValuesParam,
			String postfixUrlParam
	) {
		return this.executeForm(
				HttpMethod.POST,
				null,
				formNameValuesParam,
				ContentType.APPLICATION_FORM_URLENCODED,
				postfixUrlParam);
	}

	/**
	 * Submit a JSON based HTTP request body with JSON as a response.
	 *
	 * @param httpMethodParam The HTTP method to use.
	 * @param headerNameValuesParam The additional HTTP headers.
	 * @param baseDomainParam The object to convert to JSON and submit as {@code httpMethodParam}.
	 * @param contentTypeParam The Mime / Content type to submit as.
	 * @param postfixUrlParam URL mapping after the Base endpoint.
	 * @return Return body as JSON.
	 *
	 * @see HttpMethod
	 * @see JSONObject
	 * @see ContentType
	 * @see ABaseJSONObject
	 */
	protected JSONObject executeJson(
			HttpMethod httpMethodParam,
			List<HeaderNameValue> headerNameValuesParam,
			ABaseJSONObject baseDomainParam,
			ContentType contentTypeParam,
			String postfixUrlParam
	) {
		//Validate that something is set.
		if (baseDomainParam == null) {
			throw new RESTClientException("No JSON body to post.", RESTClientException.ErrorCode.FIELD_VALIDATE);
		}

		String bodyJsonString = baseDomainParam.toJsonObject().toString();

		return this.executeString(
				httpMethodParam,
				headerNameValuesParam,
				bodyJsonString,
				contentTypeParam,
				postfixUrlParam);
	}

	/**
	 * Submit a HTML Form based HTTP request body with JSON as a response.
	 *
	 * @param httpMethodParam The HTTP method to use.
	 * @param headerNameValuesParam The additional HTTP headers.
	 * @param formNameValuesParam The Form name and value pairs.
	 * @param contentTypeParam The Mime / Content type to submit as.
	 * @param postfixUrlParam URL mapping after the Base endpoint.
	 *
	 * @return Return body as JSON.
	 *
	 * @see HttpMethod
	 * @see JSONObject
	 * @see ContentType
	 * @see ABaseJSONObject
	 */
	protected JSONObject executeForm(
		HttpMethod httpMethodParam,
		List<HeaderNameValue> headerNameValuesParam,
		List<FormNameValue> formNameValuesParam,
		ContentType contentTypeParam,
		String postfixUrlParam
	) {
		//Validate Form Field and values...
		if (formNameValuesParam == null || formNameValuesParam.isEmpty()) {
			throw new RESTClientException("No 'Name and Value' body to post.",
					RESTClientException.ErrorCode.FIELD_VALIDATE);
		}

		StringBuilder strBuilder = new StringBuilder();

		for (FormNameValue nameValue : formNameValuesParam) {
			if (nameValue.getName() == null || nameValue.getName().trim().isEmpty()) continue;

			if (nameValue.getValue() == null) continue;

			strBuilder.append(nameValue.getName());
			strBuilder.append(EQUALS);
			strBuilder.append(nameValue.getValue());
			strBuilder.append(AMP);
		}

		String bodyJsonString = strBuilder.toString();
		bodyJsonString = bodyJsonString.substring(0, bodyJsonString.length() - 1);

		return this.executeString(
				httpMethodParam,
				headerNameValuesParam,
				bodyJsonString, contentTypeParam, postfixUrlParam);
	}

	/**
	 * Submit the {@code stringParam} as HTTP request body with JSON as a response.
	 *
	 * @param httpMethodParam The HTTP method to use.
	 * @param headerNameValuesParam The additional HTTP headers.
	 * @param stringParam The Text to submit.
	 * @param contentTypeParam The Mime / Content type to submit as.
	 * @param postfixUrlParam URL mapping after the Base endpoint.
	 *
	 * @return Return body as JSON.
	 *
	 * @see HttpMethod
	 * @see JSONObject
	 * @see ContentType
	 * @see ABaseJSONObject
	 */
	protected JSONObject executeString(
			HttpMethod httpMethodParam,
			List<HeaderNameValue> headerNameValuesParam,
			String stringParam,
			ContentType contentTypeParam,
			String postfixUrlParam
	) {
		String responseBody = this.executeTxtReceiveTxt(
				httpMethodParam,
				headerNameValuesParam,
				stringParam,
				contentTypeParam,
				postfixUrlParam);

		if (responseBody == null || responseBody.trim().isEmpty())
			throw new RESTClientException(
					"No response data from '"+ this.endpointUrl.concat(postfixUrlParam)+"'.",
					RESTClientException.ErrorCode.IO_ERROR);

		try {
			JSONObject jsonOjb = new JSONObject(responseBody);
			Error err = new Error(jsonOjb);
			if (err.isError()) throw new RESTClientException(err.getErrorMessage(), err.getErrorCode());

			return jsonOjb;
		} catch (JSONException jsonExcept) {
			//Invalid JSON Body...
			if (responseBody != null && !responseBody.trim().isEmpty()) throw new RESTClientException(
						jsonExcept.getMessage() + "\n Response Body is: \n\n" +
								responseBody,
						jsonExcept, RESTClientException.ErrorCode.JSON_PARSING);

			throw new RESTClientException(
					jsonExcept.getMessage(),
					jsonExcept, RESTClientException.ErrorCode.JSON_PARSING);
		}
	}

	/**
	 * Submit the {@code stringParam} as HTTP request body with JSON as a response.
	 *
	 * @param httpMethod The HTTP method to use.
	 * @param headerNameValues The additional HTTP headers.
	 * @param string The Text to submit.
	 * @param contentType The Mime / Content type to submit as.
	 * @param postfixUrl URL mapping after the Base endpoint.
	 *
	 * @return Return body as JSON.
	 *
	 * @see HttpMethod
	 * @see JSONObject
	 * @see ContentType
	 * @see ABaseJSONObject
	 */
	protected String executeTxtReceiveTxt(
		HttpMethod httpMethod,
		List<HeaderNameValue> headerNameValues,
		String string,
		ContentType contentType,
		String postfixUrl
	) {
		if (string == null || string.isEmpty()) throw new RESTClientException(
				"No JSON body to post.", RESTClientException.ErrorCode.FIELD_VALIDATE);

		CloseableHttpClient httpclient = this.getClient();
		String responseBody = null;
		try {
			HttpUriRequest uriRequest = null;
			//POST...
			if (httpMethod == HttpMethod.POST) {
				//When its html Form Data...
				if (contentType == ContentType.APPLICATION_FORM_URLENCODED) {
					RequestBuilder builder = RequestBuilder.post().setUri(
							this.endpointUrl.concat(postfixUrl));

					builder = this.addParamsToBuildFromString(builder,string);
					uriRequest = builder.build();
				} else {
					//JSON or any other...
					uriRequest = new HttpPost(this.endpointUrl.concat(postfixUrl));
				}

				uriRequest.setHeader(CONTENT_TYPE_HEADER, contentType.toString());
			} else if (httpMethod == HttpMethod.PUT) {
				//PUT...
				if (contentType == ContentType.APPLICATION_FORM_URLENCODED) {
					RequestBuilder builder = RequestBuilder.put().setUri(
							this.endpointUrl.concat(postfixUrl));

					builder = this.addParamsToBuildFromString(builder, string);
					uriRequest = builder.build();
				} else {
					uriRequest = new HttpPut(this.endpointUrl.concat(postfixUrl));
					uriRequest.setHeader(CONTENT_TYPE_HEADER, contentType.toString());
				}
			} else if (httpMethod == HttpMethod.DELETE) {
				//DELETE...
				uriRequest = new HttpDelete(this.endpointUrl.concat(postfixUrl));
				uriRequest.setHeader(CONTENT_TYPE_HEADER, contentType.toString());
			}

			//Check that the URI request is set.
			if (uriRequest == null) {
				throw new RESTClientException(
						"URI Request is not set for HTTP Method '"+httpMethod+"'.",
						RESTClientException.ErrorCode.ILLEGAL_STATE_ERROR);
			}

			//Set additional headers...
			if (headerNameValues != null && !headerNameValues.isEmpty()) {
				for (HeaderNameValue headerNameVal : headerNameValues) {
					if (headerNameVal.getName() == null || headerNameVal.getName().trim().isEmpty()) continue;

					if (headerNameVal.getValue() == null) continue;

					uriRequest.setHeader(headerNameVal.getName(), headerNameVal.getValue());
				}
			}

			//When HttpEntity Enclosing Request Base...
			if (uriRequest instanceof HttpEntityEnclosingRequestBase) {
				HttpEntity httpEntity = new StringEntity(string, contentType);
				((HttpEntityEnclosingRequestBase)uriRequest).setEntity(httpEntity);
			}

			// Create a custom response handler
			ResponseHandler<String> responseHandler = this.getJsonResponseHandler(
					this.endpointUrl.concat(postfixUrl));

			responseBody = this.executeHttp(httpclient, uriRequest, responseHandler, postfixUrl);
			if (responseBody == null || responseBody.trim().isEmpty()) {
				throw new RESTClientException(
						"No response data from '"+
								this.endpointUrl.concat(postfixUrl)+"'.",
						RESTClientException.ErrorCode.IO_ERROR);
			}

			return responseBody;
		} catch (RESTClientException fluidClientExcept) {
			//Fluid Client Exception...
			throw fluidClientExcept;
		} catch (Exception otherExcept) {
			//Other Exceptions...
			throw new RESTClientException(otherExcept.getMessage(),
					otherExcept, RESTClientException.ErrorCode.ILLEGAL_STATE_ERROR);
		}
	}

	/**
	 * Add params to the {@code builderParam} and returns {@code builderParam}.
	 *
	 * @param builderParam Possible existing builder.
	 * @param formDataToAddParam Form Data as Text.
	 * @return Apache HTTP commons request builder.
	 */
	private RequestBuilder addParamsToBuildFromString(
			RequestBuilder builderParam,
			String formDataToAddParam
	) {
		String[] nameValuePairs = formDataToAddParam.split(REGEX_AMP);

		if (nameValuePairs.length > 0) {
			for (String nameValuePair : nameValuePairs) {
				String[] nameValuePairArr = nameValuePair.split(REGEX_EQUALS);
				if (nameValuePairArr.length > 1) {
					String name = nameValuePairArr[0];
					String value = nameValuePairArr[1];

					builderParam = builderParam.addParameter(name, value);
				}
			}
		}

		return builderParam;
	}

	/**
	 * Get a text based response handler used mainly for JSON.
	 *
	 * @param urlCalledParam The url called.
	 * @return String based response handler.
	 */
	private ResponseHandler<String> getJsonResponseHandler(final String urlCalledParam) {
		// Create a custom response handler
		ResponseHandler<String> responseHandler = new ResponseHandler<String>() {
			/**
			 * Process the {@code responseParam} and return text if valid.
			 *
			 * @param responseParam The HTTP response from the server.
			 * @return Text response.
			 * @throws IOException If there are any communication or I/O problems.
			 */
			public String handleResponse(final HttpResponse responseParam) throws IOException {
				int status = responseParam.getStatusLine().getStatusCode();
				if (status == 404) {
					throw new RESTClientException(
							"Endpoint for Service not found. URL ["+
									urlCalledParam+"].",
							RESTClientException.ErrorCode.CONNECT_ERROR);
				} else if (status >= 200 && status < 300) {
					HttpEntity entity = responseParam.getEntity();
					String responseJsonString = (entity == null) ? null: EntityUtils.toString(entity);
					return responseJsonString;
				} else if (status == 400) {
					//Bad Request... Server Side Error meant for client...
					HttpEntity entity = responseParam.getEntity();
					String responseJsonString = (entity == null) ? null : EntityUtils.toString(entity);
					return responseJsonString;
				} else {
					HttpEntity entity = responseParam.getEntity();
					String responseString = (entity != null) ? EntityUtils.toString(entity) : null;
					throw new RESTClientException(
							"Unexpected response status: " + status+". "
							+responseParam.getStatusLine().getReasonPhrase()+". \nResponse Text ["+ responseString+"]",
							RESTClientException.ErrorCode.IO_ERROR);
				}
			}
		};

		return responseHandler;
	}

	/**
	 * Translates a string into {@code application/x-www-form-urlencoded}
	 * format using a specific encoding scheme. This method uses the
	 * supplied encoding scheme to obtain the bytes for unsafe
	 * characters.
	 *
	 * @param textParam The text to URL encode.
	 * @return Encoded text from {@code textParam}.
	 *
	 * @see URLEncoder#encode(String, String)
	 */
	public static String encodeParam(String textParam) {
		if (textParam == null) return null;
		try {
			return URLEncoder.encode(textParam, ENCODING_UTF_8);
		} catch (UnsupportedEncodingException e) {
			e.printStackTrace();
		}
		return null;
	}

	/**
	 * Checks whether the {@code textParam} is {@code null} or empty.
	 *
	 * @param textParam The text to check.
	 * @return Whether the {@code textParam} is empty.
	 */
	protected final boolean isEmpty(String textParam) {
		return (textParam == null) ? true : textParam.trim().isEmpty();
	}

	/**
	 * Creates a new Http client.
	 *
	 * If part of a test run, the Http client will accept
	 * self signed certificates.
	 *
	 * See flag {@code IS_IN_JUNIT_TEST_MODE}.En
	 *
	 * @return CloseableHttpClient that may or may not accept
	 * self signed certificates.
	 *
	 * @since v1.1
	 */
	private CloseableHttpClient getClient() {
		if (this.closeableHttpClient != null) return this.closeableHttpClient;

		//Only accept self signed certificate if in Junit test case.
		String pathToFluidTrustStore = this.getPathToFluidSpecificTrustStore();
		//Test mode...
		if (IS_IN_JUNIT_TEST_MODE || pathToFluidTrustStore != null) {
			SSLContextBuilder builder = new SSLContextBuilder();
			try {
				//builder.loadTrustMaterial(null, new TrustSelfSignedStrategy());
				if (pathToFluidTrustStore == null) {
					builder.loadTrustMaterial(new SSLTrustAll());
				} else {
					String password = this.getFluidSpecificTrustStorePassword();
					if (password == null) password = "";

					if (IS_IN_JUNIT_TEST_MODE) {
						builder.loadTrustMaterial(
								new File(pathToFluidTrustStore),
								password.toCharArray(),
								new SSLTrustAll());
					} else {
						builder.loadTrustMaterial(
								new File(pathToFluidTrustStore),
								password.toCharArray());
					}
				}
				SSLContext sslContext = builder.build();
				this.closeableHttpClient = HttpClients.custom()
						.setSSLSocketFactory(new SSLConnectionSocketFactory(sslContext))
						.setConnectionManagerShared(true)
						.setMaxConnPerRoute(200)
						.build();
			} catch (NoSuchAlgorithmException e) {
				//Changed for Java 1.6 compatibility...
				throw new RESTClientException(
						"NoSuchAlgorithm: Unable to load self signed trust material. "+e.getMessage(),
						e, RESTClientException.ErrorCode.CRYPTOGRAPHY);
			} catch (KeyManagementException e) {
				throw new RESTClientException(
						"KeyManagement: Unable to load self signed trust material. "+e.getMessage(), e,
						RESTClientException.ErrorCode.CRYPTOGRAPHY);
			} catch (KeyStoreException e) {
				throw new RESTClientException(
						"KeyStore: Unable to load self signed trust material. "+e.getMessage(), e,
						RESTClientException.ErrorCode.CRYPTOGRAPHY);
			} catch (CertificateException e) {
				throw new RESTClientException(
						"Certificate: Unable to load self signed trust material. "+e.getMessage(), e,
						RESTClientException.ErrorCode.CRYPTOGRAPHY);
			} catch (IOException ioError) {
				throw new RESTClientException(
						"IOError: Unable to load self signed trust material. "+ioError.getMessage(), ioError,
						RESTClientException.ErrorCode.CRYPTOGRAPHY);
			}
		} else {
			//Default HTTP Client...
			//this.closeableHttpClient = HttpClients.createDefault();
			this.closeableHttpClient = HttpClients.custom()
					.setMaxConnPerRoute(200)
					.setConnectionManagerShared(true)
					.build();
		}

		return this.closeableHttpClient;
	}

	/**
	 * Retrieves the system property for the Fluid specific trust store.
	 *
	 * @return The {@code fluid.httpclient.truststore} system property value.
	 *
	 * @see System
	 * @see java.util.Properties
	 */
	private String getPathToFluidSpecificTrustStore() {
		String fluidSystemTrustStore = System.getProperty(SYSTEM_PROP_TRUST_STORE);
		if (fluidSystemTrustStore == null || fluidSystemTrustStore.trim().isEmpty()) return null;

		File certFile = new File(fluidSystemTrustStore);
		if (certFile.exists() && certFile.isFile()) return fluidSystemTrustStore;

		return null;
	}

	/**
	 * Retrieves the system property for the Fluid specific trust store password.
	 *
	 * @return The {@code fluid.httpclient.truststore.password} system property value.
	 *
	 * @see System
	 * @see java.util.Properties
	 */
	private String getFluidSpecificTrustStorePassword() {
		return System.getProperty(SYSTEM_PROP_TRUST_STORE_PASSWORD);
	}

	/**
	 * If the HTTP Client is set, this will
	 * close and clean any connections that needs to be closed.
	 *
	 * @since v1.1
	 */
	public void closeAndClean() {
		CloseConnectionRunnable closeConnectionRunnable = new CloseConnectionRunnable(this);
		Thread closeConnThread = new Thread(closeConnectionRunnable, "Close ABaseClientWS Connection");
		closeConnThread.start();
	}

	/**
	 * Closes the connection stream.
	 *
	 * @see ABaseRESTClient#closeAndClean()
	 */
	@Override
	public void close() {
		this.closeAndClean();
	}

	/**
	 * Close the SQL and ElasticSearch Connection, but not in
	 * a separate {@code Thread}.
	 */
	protected void closeConnectionNonThreaded() {
		if (this.closeableHttpClient != null) {
			try {
				this.closeableHttpClient.close();
			} catch (IOException e) {
				throw new RESTClientException(
						"Unable to close Http Client connection. "+ e.getMessage(), e,
						RESTClientException.ErrorCode.IO_ERROR);
			}
		}

		this.closeableHttpClient = null;
	}

	/**
	 * Trust all SSL type connections.
	 */
	private static final class SSLTrustAll implements TrustStrategy {
		/**
		 *
		 * @param x509Certificates List of X509 certificates.
		 * @param stringParam Text.
		 * @return {@code true}, always trusted.
		 */
		@Override
		public boolean isTrusted(X509Certificate[] x509Certificates, String stringParam) {
			return true;
		}
	}

	/**
	 * Utility class to close the connection in a thread.
	 */
	private static class CloseConnectionRunnable implements Runnable {
		private ABaseRESTClient baseClientWS;

		/**
		 * The resource to close.
		 *
		 * @param aBaseClientWSParam Base utility to close.
		 */
		public CloseConnectionRunnable(ABaseRESTClient aBaseClientWSParam) {
			this.baseClientWS = aBaseClientWSParam;
		}

		/**
		 * Performs the threaded operation.
		 */
		@Override
		public void run() {
			if (this.baseClientWS == null) return;

			this.baseClientWS.closeConnectionNonThreaded();
		}
	}
}
